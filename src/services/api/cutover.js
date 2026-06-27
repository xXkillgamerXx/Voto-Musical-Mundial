export const apiCutover = {
  auth: import.meta.env.VITE_USE_API_AUTH === 'true',
  publicReads: import.meta.env.VITE_USE_API_PUBLIC_READS !== 'false',
  results: import.meta.env.VITE_USE_API_RESULTS !== 'false',
  votes: import.meta.env.VITE_USE_API_VOTES !== 'false',
  missions: import.meta.env.VITE_USE_API_MISSIONS !== 'false',
}

export const shouldUseApi = (moduleName) => Boolean(apiCutover[moduleName])
