import argparse
import json
import sys
import traceback
from pathlib import Path

from scratch_trainer import train_scratch


def emit(event: str, detail=None):
    payload = {"event": event, "detail": detail or {}}
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def main():
    parser = argparse.ArgumentParser(description="AIens training worker")
    parser.add_argument("--job", required=True, help="Path to job JSON")
    args = parser.parse_args()

    job_path = Path(args.job)
    if not job_path.exists():
        emit("training-error", {"error": f"Job file not found: {job_path}"})
        return 2

    try:
        raw = job_path.read_text(encoding="utf-8")
        if raw and raw[0] == "\ufeff":
            raw = raw.lstrip("\ufeff")
        job = json.loads(raw)
    except Exception as e:
        emit("training-error", {"error": f"Invalid job file: {e}"})
        return 2

    config = job.get("config", {})
    output_dir = job.get("output_dir")
    stop_file = Path(job.get("stop_file", str(job_path.with_suffix(".stop"))))

    if not output_dir:
        emit("training-error", {"error": "output_dir is missing in job config"})
        return 2

    mode = str(config.get("mode", "scratch")).lower().strip()

    def stop_requested() -> bool:
        return stop_file.exists()

    emit("training-status", {"message": f"Worker started in mode={mode}", "phase": "worker_start"})

    try:
        if mode != "scratch":
            raise ValueError(f"Unsupported training mode in current build: {mode}. Use scratch.")

        result = train_scratch(config, output_dir, emit, stop_requested)
        history = result.history
        final_loss = result.final_loss
        total_steps = result.total_steps
        out_dir = result.output_dir
        stopped = bool(getattr(result, "stopped", False))
        last_checkpoint = getattr(result, "last_checkpoint", "")

        emit(
            "training-complete",
            {
                "message": "Training stopped by user. Last checkpoint saved." if stopped else "Training completed successfully",
                "output_dir": out_dir,
                "final_loss": final_loss,
                "total_steps": total_steps,
                "training_history": history,
                "train_mode": "scratch",
                "stopped": stopped,
                "last_checkpoint": last_checkpoint,
            },
        )
        return 0
    except Exception as e:
        tb = traceback.format_exc()
        err = str(e)
        if "stopped by user" in err.lower():
            emit("training-error", {"error": "Stopped by user", "traceback": tb})
            return 130
        emit("training-error", {"error": err, "traceback": tb})
        return 1


if __name__ == "__main__":
    sys.exit(main())
