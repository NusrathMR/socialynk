export default function SettingsPlaceholder({ title, description }) {
  return (
    <section className="settings-card">
      <p className="settings-eyebrow">Settings</p>
      <h2>{title}</h2>
      <p className="settings-placeholder-copy">{description}</p>
    </section>
  )
}
