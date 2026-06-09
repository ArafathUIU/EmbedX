from __future__ import annotations

import json
from pathlib import Path

import pytest
from rouge_score import rouge_scorer

from app.services.llm_client import LLMClient

THRESHOLD_ROUGE1 = 0.15
HOLDOUT_PATH = Path(__file__).parent / "data" / "holdout_qa.json"


def load_holdout_qa() -> list[dict[str, str]]:
    with open(HOLDOUT_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def holdout_data() -> list[dict[str, str]]:
    return load_holdout_qa()


def run_inference_on_held_out(client: LLMClient, qa_pairs: list[dict[str, str]]):
    predictions = []
    references = []
    for pair in qa_pairs:
        context = pair.get("context", "")
        answer = client.generate(prompt=pair["question"], context=context)
        predictions.append(answer or "")
        references.append(pair["reference"])
    return predictions, references


@pytest.mark.slow
def test_rouge_score_above_threshold(holdout_data):
    client = LLMClient()
    scorer = rouge_scorer.RougeScorer(["rouge1", "rougeL"], use_stemmer=True)

    predictions, references = run_inference_on_held_out(client, holdout_data)

    scores = [scorer.score(ref, pred) for ref, pred in zip(references, predictions)]
    avg_rouge1 = sum(s["rouge1"].fmeasure for s in scores) / len(scores)

    assert avg_rouge1 >= THRESHOLD_ROUGE1, (
        f"Model quality regression detected: ROUGE-1 {avg_rouge1:.4f} < {THRESHOLD_ROUGE1}"
    )
