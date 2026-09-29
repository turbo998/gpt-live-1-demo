import {ManagedIdentityCredential} from '@azure/identity';

let managedCredential;
export function validateIdentityEndpoint(baseUrl){
  const url=new URL(baseUrl);
  if(url.protocol!=='https:'||!['.openai.azure.com','.cognitiveservices.azure.com','.services.ai.azure.com'].some(suffix=>url.hostname.endsWith(suffix)))throw new Error('托管身份仅允许 Azure AI 服务地址');
}

export async function providerHeaders({auth,baseUrl,key},credential){
  if(auth!=='managed-identity')return auth==='api-key'?{'api-key':key}:{Authorization:`Bearer ${key}`};
  validateIdentityEndpoint(baseUrl);
  try{
    managedCredential??=new ManagedIdentityCredential();
    const token=await (credential||managedCredential).getToken('https://cognitiveservices.azure.com/.default',{abortSignal:AbortSignal.timeout(10000)});
    if(!token?.token)throw new Error('No token');
    return {Authorization:`Bearer ${token.token}`};
  }catch{
    throw new Error('托管身份认证失败，请检查应用身份及模型资源权限');
  }
}
