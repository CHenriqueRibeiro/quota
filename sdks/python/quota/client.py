import os
import time
import json
import threading
import httpx
import requests
from typing import Dict, Any, Optional
from .extractors import detect_provider, extract_metadata_from_headers, extract_telemetry

class QuotaConfig:
    def __init__(
        self,
        api_key: str,
        endpoint: str = "https://quota-api.up.railway.app/collector",
        project: Optional[str] = None,
        agent: Optional[str] = None,
        environment: Optional[str] = None,
        debug: bool = False
    ):
        self.api_key = api_key
        self.endpoint = endpoint
        self.project = project
        self.agent = agent
        self.environment = environment
        self.debug = debug

class Quota:
    _config: Optional[QuotaConfig] = None
    _is_initialized: bool = False
    _original_httpx_send = None
    _original_httpx_async_send = None
    _original_requests_send = None

    @classmethod
    def init(
        cls,
        api_key: str,
        endpoint: Optional[str] = None,
        project: Optional[str] = None,
        agent: Optional[str] = None,
        environment: Optional[str] = None,
        debug: bool = False
    ) -> None:
        """Inicializa o escutador do Quota para interceptar chamadas HTTP em Python."""
        if not api_key:
            raise ValueError("[Quota SDK] Erro: api_key é obrigatória ao chamar Quota.init()")

        default_endpoint = os.getenv("QUOTA_ENDPOINT", "https://quota-api.up.railway.app/collector")
        final_endpoint = endpoint or default_endpoint

        cls._config = QuotaConfig(
            api_key=api_key,
            endpoint=final_endpoint,
            project=project,
            agent=agent,
            environment=environment,
            debug=debug
        )

        if not cls._is_initialized:
            cls._setup_httpx_interception()
            cls._setup_requests_interception()
            cls._is_initialized = True

        if cls._config.debug:
            print(f"[Quota SDK] Inicializado com sucesso. Endpoint: {cls._config.endpoint}")

    @classmethod
    def track_usage(cls, payload: Dict[str, Any]) -> None:
        """Envia um evento de uso/telemetria para o collector do Quota em background thread (non-blocking)."""
        if not cls._config:
            print("[Quota SDK] Aviso: Quota.init() não foi chamado antes de track_usage()")
            return

        def _send():
            try:
                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": cls._config.api_key
                }

                # Garante que metadados globais sejam mesclados caso não estejam presentes
                metadata = payload.get("metadata") or {}
                if "project" not in metadata and cls._config.project:
                    metadata["project"] = cls._config.project
                if "agent" not in metadata and cls._config.agent:
                    metadata["agent"] = cls._config.agent
                if "environment" not in metadata and cls._config.environment:
                    metadata["environment"] = cls._config.environment

                payload["metadata"] = metadata

                res = requests.post(
                    cls._config.endpoint,
                    headers=headers,
                    data=json.dumps(payload),
                    timeout=5
                )

                if cls._config.debug:
                    print(f"[Quota SDK] Telemetria enviada ({res.status_code}): {payload}")
            except Exception as e:
                if cls._config and cls._config.debug:
                    print(f"[Quota SDK] Erro ao enviar telemetria: {e}")

        # Dispara o envio em uma thread daemon separada para nunca travar a aplicação principal
        t = threading.Thread(target=_send, daemon=True)
        t.start()

    @classmethod
    def _setup_httpx_interception(cls) -> None:
        """Intercepta o envio de requisições síncronas e assíncronas do httpx."""
        cls._original_httpx_send = httpx.Client.send
        cls._original_httpx_async_send = httpx.AsyncClient.send

        def patched_send(self_client, request: httpx.Request, *args, **kwargs):
            url_str = str(request.url)
            provider = detect_provider(url_str)

            if not provider or (cls._config and cls._config.endpoint in url_str):
                return cls._original_httpx_send(self_client, request, *args, **kwargs)

            request_body_json = None
            if request.content:
                try:
                    request_body_json = json.loads(request.content.decode("utf-8"))
                except Exception:
                    pass

            header_metadata = extract_metadata_from_headers(request.headers)

            start_time = time.time()
            response = cls._original_httpx_send(self_client, request, *args, **kwargs)
            latency_ms = int((time.time() - start_time) * 1000)

            # Tenta extrair resposta JSON
            response_body_json = None
            try:
                response_body_json = response.json()
            except Exception:
                pass

            default_metadata = {
                "project": cls._config.project if cls._config else None,
                "agent": cls._config.agent if cls._config else None,
                "environment": cls._config.environment if cls._config else None,
            }

            telemetry = extract_telemetry(
                provider=provider,
                request_body=request_body_json,
                response_body=response_body_json,
                latency_ms=latency_ms,
                status_code=response.status_code,
                default_metadata=default_metadata,
                header_metadata=header_metadata
            )

            cls.track_usage(telemetry)
            return response

        async def patched_async_send(self_client, request: httpx.Request, *args, **kwargs):
            url_str = str(request.url)
            provider = detect_provider(url_str)

            if not provider or (cls._config and cls._config.endpoint in url_str):
                return await cls._original_httpx_async_send(self_client, request, *args, **kwargs)

            request_body_json = None
            if request.content:
                try:
                    request_body_json = json.loads(request.content.decode("utf-8"))
                except Exception:
                    pass

            header_metadata = extract_metadata_from_headers(request.headers)

            start_time = time.time()
            response = await cls._original_httpx_async_send(self_client, request, *args, **kwargs)
            latency_ms = int((time.time() - start_time) * 1000)

            response_body_json = None
            try:
                response_body_json = response.json()
            except Exception:
                pass

            default_metadata = {
                "project": cls._config.project if cls._config else None,
                "agent": cls._config.agent if cls._config else None,
                "environment": cls._config.environment if cls._config else None,
            }

            telemetry = extract_telemetry(
                provider=provider,
                request_body=request_body_json,
                response_body=response_body_json,
                latency_ms=latency_ms,
                status_code=response.status_code,
                default_metadata=default_metadata,
                header_metadata=header_metadata
            )

            cls.track_usage(telemetry)
            return response

        httpx.Client.send = patched_send
        httpx.AsyncClient.send = patched_async_send

    @classmethod
    def _setup_requests_interception(cls) -> None:
        """Intercepta chamadas do módulo requests."""
        cls._original_requests_send = requests.Session.send

        def patched_requests_send(self_session, request, *args, **kwargs):
            url_str = str(request.url)
            provider = detect_provider(url_str)

            if not provider or (cls._config and cls._config.endpoint in url_str):
                return cls._original_requests_send(self_session, request, *args, **kwargs)

            request_body_json = None
            if request.body:
                try:
                    body_bytes = request.body if isinstance(request.body, bytes) else str(request.body).encode("utf-8")
                    request_body_json = json.loads(body_bytes.decode("utf-8"))
                except Exception:
                    pass

            header_metadata = extract_metadata_from_headers(request.headers)

            start_time = time.time()
            response = cls._original_requests_send(self_session, request, *args, **kwargs)
            latency_ms = int((time.time() - start_time) * 1000)

            response_body_json = None
            try:
                response_body_json = response.json()
            except Exception:
                pass

            default_metadata = {
                "project": cls._config.project if cls._config else None,
                "agent": cls._config.agent if cls._config else None,
                "environment": cls._config.environment if cls._config else None,
            }

            telemetry = extract_telemetry(
                provider=provider,
                request_body=request_body_json,
                response_body=response_body_json,
                latency_ms=latency_ms,
                status_code=response.status_code,
                default_metadata=default_metadata,
                header_metadata=header_metadata
            )

            cls.track_usage(telemetry)
            return response

        requests.Session.send = patched_requests_send
