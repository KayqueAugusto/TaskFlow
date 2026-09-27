import type { ApiFailure, ApiSuccess } from "./data-source.js";

const API_URL=(import.meta.env.PROD?"/api":(import.meta.env.VITE_API_URL||"http://localhost:3001/api")).replace(/\/$/,"");
export class ApiError extends Error { constructor(public readonly status:number,public readonly code:string,message:string){super(message)} }
export async function apiRequest<T>(path:string,init:RequestInit={}) {
  const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(`${API_URL}${path}`,{...init,credentials:"include",headers:{...(init.body!==undefined?{"Content-Type":"application/json"}:{}),...(init.headers||{})},signal:controller.signal});
    const body=await response.json() as ApiSuccess<T>|ApiFailure;
    if(!response.ok){const error="error" in body?body.error:{code:"HTTP_ERROR",message:"Não foi possível concluir a operação."};throw new ApiError(response.status,error.code,error.message)}
    return (body as ApiSuccess<T>).data;
  } catch(error) {
    if(error instanceof ApiError)throw error;
    if(error instanceof DOMException&&error.name==="AbortError")throw new ApiError(408,"TIMEOUT","A API demorou demais para responder.");
    throw new ApiError(0,"API_UNAVAILABLE","Não foi possível conectar ao servidor.");
  } finally { window.clearTimeout(timeout); }
}
