import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import { Button } from '@/components/ui/button.jsx'
import Navbar from '@/components/landing/Navbar.jsx'
import Hero from '@/components/landing/Hero.jsx'
import BentoGrid from '@/components/landing/BentoGrid.jsx'
import HowItWorks from '@/components/landing/HowItWorks.jsx'
import IndiaStrip from '@/components/landing/IndiaStrip.jsx'
import Footer from '@/components/landing/Footer.jsx'
import './Landing.css'

function Landing() {
  const { status } = useAuth()
  const authenticated = status === 'authenticated'
  const destination = authenticated ? '/dashboard' : '/register'

  return (
    <div className="landing-page">
      <Navbar authenticated={authenticated} />
      <main>
        <Hero authenticated={authenticated} />

        <section aria-labelledby="landing-features-title" className="landing-section" id="features">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Built for everyday money</p>
            <h2 id="landing-features-title">Everything in one clear place.</h2>
            <p>Simple tools to record activity, keep wallets organized, and understand where your money goes.</p>
          </div>
          <BentoGrid />
        </section>

        <section aria-labelledby="landing-how-title" className="landing-section landing-how-section" id="how">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">A clearer routine</p>
            <h2 id="landing-how-title">From everyday activity to a clearer picture.</h2>
            <p>Keep the process simple: record, organize, and review.</p>
          </div>
          <HowItWorks />
        </section>

        <section aria-labelledby="landing-benefits-title" className="landing-section landing-benefits-section" id="benefits">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Thoughtfully made</p>
            <h2 id="landing-benefits-title">A personal view of your finances.</h2>
          </div>
          <IndiaStrip />
        </section>

        <section className="landing-final-cta">
          <div className="landing-final-cta-glow" aria-hidden="true" />
          <p className="landing-eyebrow">Make money feel more manageable</p>
          <h2>A clearer view starts with one small step.</h2>
          <p>Bring your everyday finances together and take it from there.</p>
          <div>
            <Button asChild className="landing-primary-cta" size="lg">
              <Link to={destination}>
                {authenticated ? 'Open dashboard' : 'Get started free'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {!authenticated && <Link className="landing-final-login" to="/login">Already have an account? Log in</Link>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Landing
