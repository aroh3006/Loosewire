"""Run this to regenerate evaluation/results.json against fixtures/heldout.
Prints a summary to stdout too.

    python -m evaluation.run_evaluation
"""

import json
import os

from evaluation.metrics import compute_metrics

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json")


def main() -> None:
    metrics = compute_metrics()

    with open(OUTPUT_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    o = metrics["overall"]
    print(f"held-out fixtures: {metrics['fixture_count']}")
    print(f"overall  precision={o['precision']:.3f} recall={o['recall']:.3f} f1={o['f1']:.3f}")
    print()
    for r in metrics["per_rule"]:
        print(
            f"{r['rule']:32s} tp={r['tp']} fp={r['fp']} fn={r['fn']}  "
            f"precision={r['precision']:.3f} recall={r['recall']:.3f} f1={r['f1']:.3f}"
        )
    print()
    print(f"estimated net value saved vs catching nothing: ${metrics['cost']['net_savings_usd']:.2f}")
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
