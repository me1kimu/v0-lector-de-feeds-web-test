'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Plus, Loader2, Check, AlertTriangle } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { createPasskey } from '@/lib/webauthn'

interface Passkey {
  id: string
  device_name: string
  created_at: string
  last_used_at: string | null
  transports: string[]
}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch passkeys on mount
  useEffect(() => {
    fetchPasskeys()
  }, [])

  const fetchPasskeys = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/user/passkeys')
      
      if (!response.ok) {
        throw new Error('Failed to fetch passkeys')
      }
      
      const data = await response.json()
      setPasskeys(data.passkeys || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching passkeys'
      setError(message)
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddPasskey = async () => {
    try {
      setRegistering(true)
      setError(null)

      // Get user info
      const userResponse = await fetch('/api/user/profile')
      if (!userResponse.ok) {
        throw new Error('Failed to get user info')
      }
      const userData = await userResponse.json()
      const { userId, email, displayName } = userData

      // Start registration
      const startResponse = await fetch('/api/auth/passkey/register-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          displayName: displayName || email,
          rpId: window.location.hostname,
        }),
      })

      if (!startResponse.ok) {
        throw new Error('Failed to start passkey registration')
      }

      const { options } = await startResponse.json()

      // Create passkey
      const credential = await createPasskey(options)

      // Complete registration
      const completeResponse = await fetch('/api/auth/passkey/register-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          credential,
          challenge: options.challenge,
          deviceName: deviceName || 'Unnamed device',
          rpId: window.location.hostname,
        }),
      })

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json()
        throw new Error(errorData.error || 'Failed to complete passkey registration')
      }

      toast({
        title: 'Success',
        description: 'Passkey registered successfully',
      })

      setDeviceName('')
      setOpen(false)
      await fetchPasskeys()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error registering passkey'
      setError(message)
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  const handleDeletePasskey = async (credentialId: string) => {
    try {
      setDeleting(credentialId)
      setError(null)

      const response = await fetch('/api/user/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete passkey')
      }

      toast({
        title: 'Success',
        description: 'Passkey deleted successfully',
      })

      await fetchPasskeys()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting passkey'
      setError(message)
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>Manage your passkey security credentials</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>Manage your passkey security credentials</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Passkey
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Passkey</DialogTitle>
              <DialogDescription>
                Register a new passkey to secure your account
              </DialogDescription>
            </DialogHeader>
            
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name (optional)</Label>
                <Input
                  id="device-name"
                  placeholder="e.g., iPhone 15, MacBook Pro"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  disabled={registering}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Click "Register" to add a new passkey using your device's biometric or security method.
              </p>

              <Button
                onClick={handleAddPasskey}
                disabled={registering}
                className="w-full gap-2"
              >
                {registering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Register Passkey
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {passkeys.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No passkeys registered yet</p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Passkey
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Passkey</DialogTitle>
                  <DialogDescription>
                    Register a new passkey to secure your account
                  </DialogDescription>
                </DialogHeader>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device Name (optional)</Label>
                    <Input
                      id="device-name"
                      placeholder="e.g., iPhone 15, MacBook Pro"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      disabled={registering}
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Click "Register" to add a new passkey using your device's biometric or security method.
                  </p>

                  <Button
                    onClick={handleAddPasskey}
                    disabled={registering}
                    className="w-full gap-2"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Register Passkey
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{passkey.device_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(passkey.created_at).toLocaleDateString()}
                  </p>
                  {passkey.last_used_at && (
                    <p className="text-xs text-muted-foreground">
                      Last used {new Date(passkey.last_used_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePasskey(passkey.id)}
                  disabled={deleting === passkey.id}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  {deleting === passkey.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
