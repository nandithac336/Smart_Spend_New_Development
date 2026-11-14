import EffectsSetting from '@/components/settings/EffectsSetting.jsx'
import ThemeToggle from '@/components/common/ThemeToggle.jsx'

function PreferencesSettings() {
  return (
    <div className="glass-flat rounded-2xl border border-border/70 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">Appearance settings are saved on this device.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Color theme</h3>
          <div className="mt-3"><ThemeToggle /></div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Motion effects</h3>
          <EffectsSetting />
        </div>
      </div>
      <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        <p>SmartSpend currently displays INR. Currency is not configurable through the account API.</p>
        <p>Notification preferences are not supported. Language and additional server-stored preference fields are not connected to app behavior, so they are not presented as working controls.</p>
      </div>
    </div>
  )
}

export default PreferencesSettings
