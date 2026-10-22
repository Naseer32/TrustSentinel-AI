"""
Minimal MOCK of the GenLayer SDK surface that trustsentinel.py uses.

This is NOT the real GenVM. It lets the contract's logic run under plain Python so the
rule engine, validation, access control, state transitions, rollback-on-error and the
leader/validator flow can be unit-tested offline. It does not prove behaviour on a real
GenLayer network (see README "Testing status").

Mock semantics that mirror GenLayer:
  * @gl.public.write rolls the whole contract state back when the call raises
  * @gl.public.view fails the test if the call mutates state
  * gl.vm.run_nondet_unsafe(leader, validator): leader result accepted only if a strict
    majority of validators return True (otherwise ConsensusFailure, state rolled back)
"""
import copy
import functools
import sys
import types


class UserError(Exception):
    pass


class ConsensusFailure(Exception):
    pass


class Address(str):
    def __new__(cls, v):
        s = v.lower() if isinstance(v, str) else "0x" + bytes(v).hex()
        if not (s.startswith("0x") and len(s) == 42 and all(c in "0123456789abcdef" for c in s[2:])):
            raise ValueError("bad address")
        return str.__new__(cls, s)


ZERO = Address("0x" + "00" * 20)
u256 = int
u64 = int
bigint = int


class TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls


class DynArray(list):
    def __class_getitem__(cls, item):
        return cls


def allow_storage(cls):
    return cls


class Env:
    def __init__(self):
        self.sender = ZERO
        self.web = {}            # url -> (status, bytes) | Exception | callable
        self.llm = None          # callable(prompt) -> str
        self.prompts = []
        self.web_calls = []
        self.validators = [None]  # each None or {"web":..., "llm":...} override
        self.malicious_leader = None


ENV = Env()


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _Resp:
    def __init__(self, status, body):
        self.status_code = status
        self.body = body


def _web_get(url):
    ENV.web_calls.append(url)
    v = ENV.web.get(url)
    if callable(v):
        v = v()
    if isinstance(v, Exception):
        raise v
    if v is None:
        raise RuntimeError("mock: no response configured for " + url)
    return _Resp(v[0], v[1])


def _exec_prompt(prompt, **kw):
    ENV.prompts.append(prompt)
    if ENV.llm is None:
        raise RuntimeError("mock: no llm configured")
    return ENV.llm(prompt)


def _run_nondet_unsafe(leader_fn, validator_fn):
    if ENV.malicious_leader is not None:
        res = Return(ENV.malicious_leader())
    else:
        try:
            res = Return(leader_fn())
        except UserError as e:
            res = e
    votes = []
    saved = (ENV.web, ENV.llm)
    for override in ENV.validators:
        if override:
            ENV.web = override.get("web", saved[0])
            ENV.llm = override.get("llm", saved[1])
        try:
            ok = bool(validator_fn(res))
        except Exception:
            ok = False
        ENV.web, ENV.llm = saved
        votes.append(ok)
    if sum(votes) * 2 <= len(votes):
        raise ConsensusFailure("validators rejected the leader result")
    if isinstance(res, Return):
        return res.calldata
    raise res


def _write(fn):
    @functools.wraps(fn)
    def wrapper(self, *a, **k):
        snap = copy.deepcopy(self.__dict__)
        try:
            return fn(self, *a, **k)
        except BaseException:
            self.__dict__.clear()
            self.__dict__.update(snap)
            raise
    wrapper._gl_kind = "write"
    return wrapper


def _view(fn):
    @functools.wraps(fn)
    def wrapper(self, *a, **k):
        snap = copy.deepcopy(self.__dict__)
        out = fn(self, *a, **k)
        assert self.__dict__ == snap, f"view method {fn.__name__} mutated state"
        return out
    wrapper._gl_kind = "view"
    return wrapper


class Contract:
    def __new__(cls, *a, **k):
        obj = object.__new__(cls)
        for name, tp in getattr(cls, "__annotations__", {}).items():
            if tp is TreeMap:
                obj.__dict__[name] = TreeMap()
            elif tp is DynArray:
                obj.__dict__[name] = DynArray()
            elif tp is bool:
                obj.__dict__[name] = False
            elif tp is str:
                obj.__dict__[name] = ""
            elif tp is Address:
                obj.__dict__[name] = ZERO
            else:
                obj.__dict__[name] = 0
        return obj


class _Msg:
    @property
    def sender_address(self):
        return ENV.sender


gl = types.SimpleNamespace(
    Contract=Contract,
    UserError=UserError,
    public=types.SimpleNamespace(view=_view, write=_write),
    message=_Msg(),
    nondet=types.SimpleNamespace(
        web=types.SimpleNamespace(get=_web_get),
        exec_prompt=_exec_prompt,
    ),
    vm=types.SimpleNamespace(
        Return=Return, UserError=UserError, run_nondet_unsafe=_run_nondet_unsafe,
    ),
)

_mod = types.ModuleType("genlayer")
for _n, _v in dict(gl=gl, Address=Address, u256=u256, u64=u64, bigint=bigint, TreeMap=TreeMap,
                   DynArray=DynArray, allow_storage=allow_storage).items():
    setattr(_mod, _n, _v)
_mod.__all__ = ["gl", "Address", "u256", "u64", "bigint", "TreeMap", "DynArray", "allow_storage"]
sys.modules["genlayer"] = _mod
