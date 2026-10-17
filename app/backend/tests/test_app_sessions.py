import json
from pathlib import Path

from app.services.app_sessions_service import load_app_sessions


def _write(root: Path, name: str, **fields: object) -> None:
    folder = root / "acc" / "org"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_text(json.dumps(fields), encoding="utf-8")


def test_lit_titre_dossier_et_activite(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "local_a.json",
        cliSessionId="abc",
        title="Configurations et résultats montage",
        cwd="C:\\worktrees\\x",
        originCwd="C:\\bo-test",
        lastActivityAt=1_791_321_000_000,
    )
    got = load_app_sessions(root=tmp_path)
    assert got["abc"]["title"] == "Configurations et résultats montage"
    assert got["abc"]["folder"] == "bo-test"
    assert got["abc"]["last_activity"] == 1_791_321_000


def test_ignore_fichiers_sans_id_ou_casses(tmp_path: Path) -> None:
    _write(tmp_path, "local_b.json", title="sans id")
    (tmp_path / "acc" / "org" / "local_c.json").write_text("{pas du json", encoding="utf-8")
    _write(tmp_path, "scheduled-tasks.json", cliSessionId="zzz", title="x")
    assert load_app_sessions(root=tmp_path) == {}


def test_dossier_absent(tmp_path: Path) -> None:
    assert load_app_sessions(root=tmp_path / "nope") == {}


def test_lit_modele_effort_archive_et_id_appli(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "local_d.json",
        sessionId="local_6f2a-9bC",
        cliSessionId="cli-d",
        model="claude-sonnet-5-5",
        effort="medium",
        isArchived=True,
    )
    got = load_app_sessions(root=tmp_path)["cli-d"]
    assert got["app_session_id"] == "local_6f2a-9bC"
    assert got["model"] == "claude-sonnet-5-5"
    assert got["effort"] == "medium"
    assert got["archived"] is True


def test_valeurs_par_defaut_des_nouveaux_champs(tmp_path: Path) -> None:
    _write(tmp_path, "local_e.json", cliSessionId="cli-e", model=12, effort=None)
    got = load_app_sessions(root=tmp_path)["cli-e"]
    assert got["app_session_id"] is None
    assert got["model"] is None
    assert got["effort"] is None
    assert got["archived"] is False


def test_session_id_invalide_donne_none(tmp_path: Path) -> None:
    for i, bad in enumerate(["abc", "local_", "local_a b", "local_../x", "local_" + "a" * 65, 7]):
        _write(tmp_path, f"local_bad{i}.json", cliSessionId=f"cli-bad{i}", sessionId=bad)
    _write(tmp_path, "local_ok.json", cliSessionId="cli-ok", sessionId="local_" + "a" * 64)
    got = load_app_sessions(root=tmp_path)
    for i in range(6):
        assert got[f"cli-bad{i}"]["app_session_id"] is None
    assert got["cli-ok"]["app_session_id"] == "local_" + "a" * 64


def test_is_archived_faux_ou_absent(tmp_path: Path) -> None:
    _write(tmp_path, "local_f.json", cliSessionId="cli-f", isArchived=False)
    _write(tmp_path, "local_g.json", cliSessionId="cli-g", isArchived="oui")
    got = load_app_sessions(root=tmp_path)
    assert got["cli-f"]["archived"] is False
    assert got["cli-g"]["archived"] is False


def test_anciens_ids_pointent_vers_la_meme_conversation(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "local_h.json",
        cliSessionId="cli-new",
        title="Reprise",
        priorCliSessionIds=["cli-old1", "cli-old2", "", 5, "cli-new"],
    )
    got = load_app_sessions(root=tmp_path)
    assert set(got) == {"cli-new", "cli-old1", "cli-old2"}
    assert got["cli-old1"] is got["cli-new"]
    assert got["cli-old2"]["title"] == "Reprise"


def test_id_principal_gagne_sur_ancien_id_quel_que_soit_l_ordre(tmp_path: Path) -> None:
    # "a" trie avant "z" : on teste les deux ordres de fichiers.
    _write(tmp_path, "local_a.json", cliSessionId="cli-a", title="A", priorCliSessionIds=["shared"])
    _write(tmp_path, "local_z.json", cliSessionId="shared", title="Z")
    assert load_app_sessions(root=tmp_path)["shared"]["title"] == "Z"

    other = tmp_path / "autre"
    _write(other, "local_a.json", cliSessionId="shared", title="A")
    _write(other, "local_z.json", cliSessionId="cli-z", title="Z", priorCliSessionIds=["shared"])
    assert load_app_sessions(root=other)["shared"]["title"] == "A"
