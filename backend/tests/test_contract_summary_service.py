import json
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.exceptions import ContractNotFoundError, LLMServiceError
from app.db.models import ContractStatus
from app.schemas.contracts import ContractSummaryResponse
from app.services import contract_service as contract_service_module
from app.services.contract_service import ContractService


class FakeRepository:
    def __init__(self, contract):
        self.contract = contract

    async def get_by_id(self, db, contract_id):
        return self.contract


class FakeLLM:
    model_name = "test-summary-model"

    def __init__(self, content):
        self.content = content
        self.messages = None

    async def ainvoke(self, messages):
        self.messages = messages
        return SimpleNamespace(content=self.content)


def make_contract(**overrides):
    values = {
        "id": uuid4(),
        "filename": "stored-contract.pdf",
        "original_filename": "contract.pdf",
        "status": ContractStatus.PROCESSED,
        "extracted_text": "This service agreement is effective January 1, 2026.",
        "page_count": 3,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def valid_summary_payload(**overrides):
    payload = {
        "executive_summary": "This agreement sets out service delivery and payment obligations.",
        "contract_type": "Service Agreement",
        "governing_law": "New York",
        "parties": {
            "service_provider": "Acme Services LLC",
            "client": "Example Corp",
            "other_parties": [],
        },
        "key_dates": {
            "effective_date": "January 1, 2026",
            "expiry_date": None,
            "renewal_date": None,
            "termination_notice_deadline": "30 days before termination",
        },
        "payment_terms": "Client pays monthly invoices within 30 days.",
        "termination_conditions": "Either party may terminate with 30 days notice.",
        "key_obligations": ["Provider must deliver the services.", "Client must pay invoices."],
        "risk_flags": ["Termination terms should be reviewed."],
        "confidence": 0.86,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_summarize_contract_returns_structured_summary(monkeypatch):
    contract = make_contract()
    llm = FakeLLM(json.dumps(valid_summary_payload()))
    monkeypatch.setattr(contract_service_module, "get_llm", lambda: llm)

    service = ContractService(repository=FakeRepository(contract))

    result = await service.summarize_contract(db=None, contract_id=contract.id)

    assert isinstance(result, ContractSummaryResponse)
    assert result.contract_id == contract.id
    assert result.filename == contract.filename
    assert result.contract_type == "Service Agreement"
    assert result.parties.client == "Example Corp"
    assert result.key_dates.effective_date == "January 1, 2026"
    assert result.key_obligations == ["Provider must deliver the services.", "Client must pay invoices."]
    assert result.risk_flags == ["Termination terms should be reviewed."]
    assert result.confidence == 0.86
    assert result.model_used == "test-summary-model"
    assert llm.messages is not None


@pytest.mark.asyncio
async def test_summarize_contract_raises_when_contract_not_found():
    contract_id = uuid4()
    service = ContractService(repository=FakeRepository(None))

    with pytest.raises(ContractNotFoundError):
        await service.summarize_contract(db=None, contract_id=contract_id)


@pytest.mark.asyncio
async def test_summarize_contract_rejects_unprocessed_contract():
    contract = make_contract(status=ContractStatus.PROCESSING)
    service = ContractService(repository=FakeRepository(contract))

    with pytest.raises(HTTPException) as exc_info:
        await service.summarize_contract(db=None, contract_id=contract.id)

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_summarize_contract_rejects_missing_extracted_text():
    contract = make_contract(extracted_text="")
    service = ContractService(repository=FakeRepository(contract))

    with pytest.raises(HTTPException) as exc_info:
        await service.summarize_contract(db=None, contract_id=contract.id)

    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_summarize_contract_raises_for_non_json_llm_response(monkeypatch):
    contract = make_contract()
    monkeypatch.setattr(contract_service_module, "get_llm", lambda: FakeLLM("not json"))
    service = ContractService(repository=FakeRepository(contract))

    with pytest.raises(LLMServiceError):
        await service.summarize_contract(db=None, contract_id=contract.id)


@pytest.mark.asyncio
async def test_summarize_contract_raises_for_schema_mismatch(monkeypatch):
    contract = make_contract()
    invalid_payload = valid_summary_payload(confidence="high")
    monkeypatch.setattr(contract_service_module, "get_llm", lambda: FakeLLM(json.dumps(invalid_payload)))
    service = ContractService(repository=FakeRepository(contract))

    with pytest.raises(LLMServiceError):
        await service.summarize_contract(db=None, contract_id=contract.id)
