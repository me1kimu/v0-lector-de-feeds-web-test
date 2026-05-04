'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { PasskeyManager } from '@/components/profile/passkey-manager'

interface UserProfile {
  userId: string
  email: string
  displayName: string
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/user/profile')
        
        if (response.status === 401) {
          router.push('/auth/login')
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }

        const data = await response.json()
        setProfile(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error fetching profile'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Logged out successfully',
        })
        router.push('/auth/login')
      } else {
        throw new Error('Failed to sign out')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error signing out'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Unable to load profile. Please try again.
            </p>
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full mt-4"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and security</p>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{profile.email}</p>
            </div>
            {profile.displayName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Display Name</p>
                <p className="text-lg">{profile.displayName}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Member Since</p>
              <p className="text-lg">{new Date(profile.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Passkey Manager */}
        <PasskeyManager />

        {/* Sign Out */}
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Sign Out</CardTitle>
            <CardDescription>End your current session</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
              className="gap-2"
            >
              {signingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing Out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
