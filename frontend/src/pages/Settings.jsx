import PageHeader from '@/components/common/PageHeader.jsx'
import AccountSettings from '@/components/settings/AccountSettings.jsx'
import PreferencesSettings from '@/components/settings/PreferencesSettings.jsx'
import ProfileSettings from '@/components/settings/ProfileSettings.jsx'
import SecuritySettings from '@/components/settings/SecuritySettings.jsx'

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'security', label: 'Security' },
  { id: 'account', label: 'Account' },
]

function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage the account details and preferences supported by SmartSpend."
        eyebrow="Your account"
        title="Settings"
      />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {SECTIONS.map(({ id, label }) => (
          <a
            className="rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`#${id}`}
            key={id}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="space-y-6">
        <section className="scroll-mt-24" id="profile">
          <ProfileSettings />
        </section>
        <section className="scroll-mt-24" id="preferences">
          <PreferencesSettings />
        </section>
        <section className="scroll-mt-24" id="security">
          <SecuritySettings />
        </section>
        <section className="scroll-mt-24" id="account">
          <AccountSettings />
        </section>
      </div>
    </div>
  )
}

export default Settings
