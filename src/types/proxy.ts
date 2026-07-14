export interface ProxyResponse {
  requestId: string;
  provider: string;
  model: string;
  billingGroup: string;
  success: boolean;
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}