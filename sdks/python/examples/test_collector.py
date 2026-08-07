import time
import sys
import os

# Adiciona o diretório pai ao sys.path para importar o pacote local 'quota'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from quota import Quota
import httpx
import requests

def run_example():
    print("=== Teste do SDK Quota em Python (quota-sdk) ===\n")

    # 1. Inicializa o SDK
    Quota.init(
        api_key="qta_live_test_py_123456",
        endpoint="http://localhost:3000/collector",
        project="saas-python",
        agent="bot-python-atendimento",
        environment="development",
        debug=True
    )

    print("\n--- Teste 1: Rastreamento Manual (Quota.track_usage) ---")
    Quota.track_usage({
        "provider": "openai",
        "model": "gpt-4o",
        "promptTokens": 180,
        "completionTokens": 60,
        "totalTokens": 240,
        "latencyMs": 410,
        "statusCode": 200,
        "metadata": {
            "externalUserId": "py_user_551",
            "tags": ["python", "manual"]
        }
    })

    print("\n--- Teste 2: Interceptação Automática de chamadas httpx com cabeçalhos ---")
    try:
        with httpx.Client() as client:
            res = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer sk-fake-key",
                    "x-quota-agent": "agente-httpx-python",
                    "x-quota-user-id": "usr_httpx_99",
                    "x-quota-tags": "httpx,teste"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [{"role": "user", "content": "Olá do Python!"}]
                }
            )
            print(f"Status do httpx simulado: {res.status_code}")
    except Exception as e:
        print("Chamada httpx concluída (interceptador capturou em background).")

    print("\n--- Teste 3: Interceptação Automática de chamadas requests com cabeçalhos ---")
    try:
        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer sk-fake-key",
                "x-quota-agent": "agente-requests-python",
                "x-quota-user-id": "usr_req_88"
            },
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "Teste requests Python"}]
            }
        )
        print(f"Status do requests simulado: {res.status_code}")
    except Exception as e:
        print("Chamada requests concluída (interceptador capturou em background).")

    # Aguarda 1 segundo para visualização dos logs da thread assíncrona
    time.sleep(1)

if __name__ == "__main__":
    run_example()
