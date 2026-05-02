/**
 * WebAuthn/Passkey client-side utilities
 */

import { base64urlEncode, base64urlDecode } from './encryption'

export interface PasskeyCredential {
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    attestationObject?: string
    authenticatorData?: string
    signature?: string
    userHandle?: string
  }
  authenticatorAttachment?: string
  clientExtensionResults?: Record<string, unknown>
}

export interface RegistrationOptions {
  challenge: string
  rp: {
    name: string
    id: string
  }
  user: {
    id: string
    name: string
    displayName: string
  }
  pubKeyCredParams: Array<{
    type: 'public-key'
    alg: number
  }>
  timeout?: number
  attestation?: AttestationConveyancePreference
  authenticatorSelection?: AuthenticatorSelectionCriteria
  excludeCredentials?: Array<{
    id: string
    type: 'public-key'
    transports?: AuthenticatorTransport[]
  }>
}

export interface AuthenticationOptions {
  challenge: string
  timeout?: number
  rpId: string
  allowCredentials?: Array<{
    id: string
    type: 'public-key'
    transports?: AuthenticatorTransport[]
  }>
  userVerification?: UserVerificationRequirement
}

// Check if WebAuthn is supported
export function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  )
}

// Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Check if conditional UI (autofill) is supported
export async function isConditionalUISupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  
  try {
    // @ts-expect-error - isConditionalMediationAvailable may not be in types yet
    return await PublicKeyCredential.isConditionalMediationAvailable?.() ?? false
  } catch {
    return false
  }
}

// Create a new passkey (registration)
export async function createPasskey(
  options: RegistrationOptions
): Promise<PasskeyCredential> {
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: base64urlDecode(options.challenge),
    rp: options.rp,
    user: {
      id: base64urlDecode(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout || 60000,
    attestation: 'direct',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    excludeCredentials: options.excludeCredentials?.map((cred) => ({
      id: base64urlDecode(cred.id),
      type: cred.type as PublicKeyCredentialType,
      transports: cred.transports,
    })),
  }

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential

  if (!credential) {
    throw new Error('Failed to create credential')
  }

  const response = credential.response as AuthenticatorAttestationResponse

  return {
    id: credential.id,
    rawId: base64urlEncode(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: base64urlEncode(response.clientDataJSON),
      attestationObject: base64urlEncode(response.attestationObject),
    },
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

// Authenticate with an existing passkey
export async function authenticateWithPasskey(
  options: AuthenticationOptions,
  conditional: boolean = false
): Promise<PasskeyCredential> {
  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge: base64urlDecode(options.challenge),
    timeout: options.timeout || 60000,
    rpId: options.rpId,
    allowCredentials: options.allowCredentials?.map((cred) => ({
      id: base64urlDecode(cred.id),
      type: cred.type,
      transports: cred.transports,
    })),
    userVerification: options.userVerification || 'required',
  }

  const credentialRequestOptions: CredentialRequestOptions = {
    publicKey: publicKeyCredentialRequestOptions,
    mediation: conditional ? 'conditional' : 'optional',
  }

  const credential = (await navigator.credentials.get(
    credentialRequestOptions
  )) as PublicKeyCredential

  if (!credential) {
    throw new Error('Failed to get credential')
  }

  const response = credential.response as AuthenticatorAssertionResponse

  return {
    id: credential.id,
    rawId: base64urlEncode(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: base64urlEncode(response.clientDataJSON),
      authenticatorData: base64urlEncode(response.authenticatorData),
      signature: base64urlEncode(response.signature),
      userHandle: response.userHandle
        ? base64urlEncode(response.userHandle)
        : undefined,
    },
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

// Abort a WebAuthn operation
export function createAbortController(): AbortController {
  return new AbortController()
}
