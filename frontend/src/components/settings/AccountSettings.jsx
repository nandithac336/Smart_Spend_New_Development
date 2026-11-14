import LogoutButton from '@/components/layout/LogoutButton.jsx'

function AccountSettings() {
  return (
    <div className="glass-flat rounded-2xl border border-border/70 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Account management</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Account deletion is not supported by the current backend, so no delete action is available.
      </p>
      <div className="mt-5 rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
        Signing out clears this session and its cached app data. If offline transactions are queued, they remain saved for this account and the sign-out confirmation explains what will be kept.
      </div>
      <LogoutButton className="mt-5" variant="outline" />
    </div>
  )
}

export default AccountSettings
