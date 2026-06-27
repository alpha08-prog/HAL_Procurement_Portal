import json
from pathlib import Path

class CaseObject:
    def __init__(self):
        self.data = {}
        self.deltas = {}
        self.generated = {}
        self.carry_forward = {}
        self.formats = {}
        self.path = []
        self.skipped = []

    def update(self, stage, fields):
        self.deltas[stage] = fields
        self.data.update({k: v for k, v in (fields or {}).items() if v is not None})

    def delta(self, stage):
        return self.deltas.get(stage, {})

    def set_output(self, stage, text):
        self.generated[stage] = text

    def set_carry_forward(self, stage, text):
        self.carry_forward[stage] = text

    def set_format(self, fid, d):
        self.formats[fid] = d

    def add_path(self, stage):
        self.path.append(stage)

    def skip(self, stage):
        self.skipped.append(stage)

    def full_output(self, stage):
        cf = self.carry_forward.get(stage, "")
        gen = self.generated.get(stage, "")
        return f"{cf}\n\n{gen}".strip() if cf else gen

    def save(self, path):
        Path(path).write_text(
            json.dumps({
                "data": self.data,
                "deltas": self.deltas,
                "generated": self.generated,
                "carry_forward": self.carry_forward,
                "formats": self.formats,
                "path": self.path,
                "skipped": self.skipped,
            }, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

    @classmethod
    def load(cls, path):
        d = json.loads(Path(path).read_text(encoding="utf-8"))
        obj = cls()
        obj.data = d.get("data", {})
        obj.deltas = d.get("deltas", {})
        obj.generated = d.get("generated", {})
        obj.carry_forward = d.get("carry_forward", {})
        obj.formats = d.get("formats", {})
        obj.path = d.get("path", [])
        obj.skipped = d.get("skipped", [])
        return obj
