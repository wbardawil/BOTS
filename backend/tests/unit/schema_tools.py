"""Tiny JSON-schema helpers for the unit tests (no jsonschema dependency)."""


def assert_closed_object_schema(schema: dict, path: str = "$") -> None:
    """Every object in the tree declares additionalProperties: false and required == its property keys."""
    kind = schema.get("type")
    if kind == "object":
        assert schema.get("additionalProperties") is False, f"{path}: additionalProperties must be false"
        props = schema.get("properties") or {}
        assert set(schema.get("required") or []) == set(props), f"{path}: required != properties"
        for key, sub in props.items():
            assert_closed_object_schema(sub, f"{path}.{key}")
    elif kind == "array":
        assert_closed_object_schema(schema["items"], f"{path}[]")


def check_shape(schema: dict, value, path: str = "$") -> None:
    """Walk the parts of JSON schema these schemas use: type, enum, required, properties, items."""
    kind = schema.get("type")
    if kind == "object":
        assert isinstance(value, dict), f"{path}: expected object"
        for key in schema.get("required") or []:
            assert key in value, f"{path}.{key} missing"
        props = schema.get("properties") or {}
        if schema.get("additionalProperties") is False:
            extra = set(value) - set(props)
            assert not extra, f"{path}: unexpected keys {sorted(extra)}"
        for key, sub in props.items():
            if key in value:
                check_shape(sub, value[key], f"{path}.{key}")
    elif kind == "array":
        assert isinstance(value, list), f"{path}: expected array"
        for i, item in enumerate(value):
            check_shape(schema["items"], item, f"{path}[{i}]")
    elif kind == "string":
        assert isinstance(value, str), f"{path}: expected string, got {value!r}"
    elif kind == "number":
        assert isinstance(value, (int, float)) and not isinstance(value, bool), f"{path}: expected number"
    elif kind == "integer":
        assert isinstance(value, int) and not isinstance(value, bool), f"{path}: expected integer"
    elif kind == "boolean":
        assert isinstance(value, bool), f"{path}: expected boolean"
    if "enum" in schema:
        assert value in schema["enum"], f"{path}: {value!r} not in {schema['enum']}"
