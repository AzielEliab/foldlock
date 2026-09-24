from foldlock.doctor import run_doctor


def test_doctor_passes() -> None:
    assert run_doctor(as_json=True) == 0


def test_doctor_human_is_plain(capsys) -> None:
    assert run_doctor() == 0
    out = capsys.readouterr().out
    assert "pass  version" in out
    assert "Doctor passed." in out
    assert "Next:" in out
    assert "THIS IS NOT" not in out
