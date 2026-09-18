export const metadata = {
  title: "Privacy Policy | Spin the Wheel!",
  description: "Privacy Policy and Data Handling Practices",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="glass-panel" style={{ padding: "3rem" }}>
        <h1 style={{ marginBottom: "2rem", color: "var(--accent-blue)" }}>Privacy Policy</h1>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", lineHeight: "1.6", color: "var(--text-color)" }}>
          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "var(--accent-pink)" }}>1. Data Collection and Usage</h2>
            <p>
              We only collect the minimum amount of information necessary to provide you with the &quot;Wheely Useful Utils!&quot; service. 
              This includes your account credentials and the configuration data for the wheels you create. 
              <strong> We strictly do not share, sell, or rent any of your personal or configuration data to any external or third parties.</strong>
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "var(--accent-pink)" }}>2. Security and Encryption</h2>
            <p>
              Your security is our priority. All account and configuration data is <strong>encrypted at rest and stored securely on Amazon Web Services (AWS)</strong> using AWS-managed Key Management Service (KMS) encryption. 
              Communication between your browser and our servers is strictly enforced via HTTPS to ensure your data is encrypted in transit.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "var(--accent-pink)" }}>3. Account Deletion and Data Control</h2>
            <p>
              You have complete control over your data. At any time, you can permanently delete your account and all associated data directly from the application.
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              To do so, simply navigate to your <strong>Dashboard</strong>, scroll to the <strong>Account Settings</strong> section, and select <strong>&quot;Delete Account&quot;</strong>. 
              This will instantaneously and irrevocably remove your user profile, authentication credentials, and all wheels/categories you have created from our databases.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "var(--accent-pink)" }}>4. Cookies and Session Management</h2>
            <p>
              We utilize a single, secure, HTTP-only cookie (`auth_token`) solely for the purpose of maintaining your active login session. We do not use any third-party tracking cookies, analytics, or advertising pixels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
