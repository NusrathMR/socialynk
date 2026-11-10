import LegalPage from "./LegalPage.jsx";
import privacyContent from "./privacyContent.js";

function PrivacyPage() {
  return <LegalPage content={privacyContent} currentPage="privacy" />;
}

export default PrivacyPage;
