from typing import Dict, Any, Optional, Tuple, List

def detect_provider(url: str) -> Optional[str]:
    """Identifica o provedor de IA com base na URL de destino da requisição."""
    lowercase_url = url.lower()
    if "api.openai.com" in lowercase_url:
        return "openai"
    elif "api.anthropic.com" in lowercase_url:
        return "anthropic"
    elif "generativelanguage.googleapis.com" in lowercase_url:
        return "google"
    elif "api.groq.com" in lowercase_url:
        return "groq"
    elif "api.mistral.ai" in lowercase_url:
        return "mistral"
    elif "api.together.xyz" in lowercase_url:
        return "together"
    elif "api.cohere.com" in lowercase_url:
        return "cohere"
    return None

def extract_metadata_from_headers(headers: Any) -> Dict[str, Any]:
    """Extrai metadados customizados a partir dos cabeçalhos HTTP da requisição (ex: x-quota-agent)."""
    if not headers:
        return {}

    # Normaliza headers para um dicionário case-insensitive
    normalized_headers: Dict[str, str] = {}
    if hasattr(headers, "items"):
        for k, v in headers.items():
            normalized_headers[str(k).lower()] = str(v)
    elif isinstance(headers, (list, tuple)):
        for item in headers:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                normalized_headers[str(item[0]).lower()] = str(item[1])

    get_val = lambda name: normalized_headers.get(name.lower())

    project = get_val("x-quota-project")
    agent = get_val("x-quota-agent")
    environment = get_val("x-quota-environment")
    external_user_id = get_val("x-quota-user-id")
    request_group = get_val("x-quota-request-group")
    billing_group = get_val("x-quota-billing-group")
    tags_str = get_val("x-quota-tags")

    tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else None

    result: Dict[str, Any] = {}
    if project: result["project"] = project
    if agent: result["agent"] = agent
    if environment: result["environment"] = environment
    if external_user_id: result["externalUserId"] = external_user_id
    if request_group: result["requestGroup"] = request_group
    if billing_group: result["billingGroup"] = billing_group
    if tags: result["tags"] = tags

    return result

def extract_telemetry(
    provider: str,
    request_body: Optional[Dict[str, Any]],
    response_body: Optional[Dict[str, Any]],
    latency_ms: int,
    status_code: int,
    default_metadata: Optional[Dict[str, Any]] = None,
    header_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Extrai os dados de telemetria e contagem de tokens."""
    request_body = request_body or {}
    response_body = response_body or {}
    default_metadata = default_metadata or {}
    header_metadata = header_metadata or {}

    model = response_body.get("model") or request_body.get("model") or "unknown"

    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    cached_tokens = 0
    reasoning_tokens = 0
    cache_creation_tokens = 0

    if provider in ["openai", "groq", "together", "mistral"]:
        usage = response_body.get("usage", {})
        if usage:
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
            prompt_details = usage.get("prompt_tokens_details", {}) or {}
            cached_tokens = prompt_details.get("cached_tokens", 0)
            comp_details = usage.get("completion_tokens_details", {}) or {}
            reasoning_tokens = comp_details.get("reasoning_tokens", 0)
    elif provider == "anthropic":
        usage = response_body.get("usage", {})
        if usage:
            prompt_tokens = usage.get("input_tokens", 0)
            completion_tokens = usage.get("output_tokens", 0)
            total_tokens = prompt_tokens + completion_tokens
            cached_tokens = usage.get("cache_read_input_tokens", 0)
            cache_creation_tokens = usage.get("cache_creation_input_tokens", 0)
    elif provider == "google":
        usage = response_body.get("usageMetadata", {})
        if usage:
            prompt_tokens = usage.get("promptTokenCount", 0)
            completion_tokens = usage.get("candidatesTokenCount", 0)
            total_tokens = usage.get("totalTokenCount", prompt_tokens + completion_tokens)
            cached_tokens = usage.get("cachedContentTokenCount", 0)
    else:
        usage = response_body.get("usage") or response_body.get("usageMetadata") or {}
        if usage:
            prompt_tokens = usage.get("prompt_tokens") or usage.get("promptTokenCount") or usage.get("input_tokens") or 0
            completion_tokens = usage.get("completion_tokens") or usage.get("candidatesTokenCount") or usage.get("output_tokens") or 0
            total_tokens = usage.get("total_tokens") or usage.get("totalTokenCount") or (prompt_tokens + completion_tokens)

    body_metadata = request_body.get("metadata") or {}
    merged_metadata = {
        "project": header_metadata.get("project") or body_metadata.get("project") or request_body.get("project") or default_metadata.get("project"),
        "agent": header_metadata.get("agent") or body_metadata.get("agent") or request_body.get("agent") or default_metadata.get("agent"),
        "environment": header_metadata.get("environment") or body_metadata.get("environment") or default_metadata.get("environment"),
        "externalUserId": header_metadata.get("externalUserId") or body_metadata.get("externalUserId"),
        "requestGroup": header_metadata.get("requestGroup") or body_metadata.get("requestGroup"),
        "tags": header_metadata.get("tags") or body_metadata.get("tags") or default_metadata.get("tags"),
    }

    # Remove chaves com valor None para limpar o JSON
    merged_metadata = {k: v for k, v in merged_metadata.items() if v is not None}

    return {
        "provider": provider,
        "model": model,
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "totalTokens": total_tokens,
        "cachedTokens": cached_tokens,
        "reasoningTokens": reasoning_tokens,
        "cacheCreationTokens": cache_creation_tokens,
        "latencyMs": latency_ms,
        "statusCode": status_code,
        "success": 200 <= status_code < 300,
        "billingGroup": header_metadata.get("billingGroup") or request_body.get("billingGroup"),
        "metadata": merged_metadata
    }
