import LegalPage from "./LegalPage.jsx";
import termsContent from "./termsContent.js";

function TermsPage() {
  return <LegalPage content={termsContent} currentPage="terms" />;
}

export default TermsPage;
