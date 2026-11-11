import "./loginPage.css";
import { useState } from "react";
import ForgotPasswordModal from "../forgetPassword/forgetPassword.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext/authContext.jsx";
import { Link } from "react-router-dom";
import api from "../../api/api.js"
import PasswordInput from "../passwordInput/PasswordInput.jsx"


function LoginPage(){

    const [email,setEmail] = useState(null)
    const [password,setPassword] = useState(null)
    const [message,setMessage] = useState(null)
    const [showForgot, setShowForgot] = useState(false);
    const [status,setStatus] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)

    const {login} = useAuth()
    const navigate = useNavigate()


    const handleSignIn = async (event)=>{
        event.preventDefault()
        setIsSubmitting(true)

        try{
            const response = await api.post("/user/signin", { email, password, rememberMe }, {
                validateStatus: () => true,
            })

            const replay = response.data
            setMessage(replay.message)

            if(response.status >= 200 && response.status < 300){
            
                login(replay.token, replay.user )
                navigate("/dashboard", { replace: true })

                // setEmail(null)
                // setPassword(null)

                
            }

            setStatus(response.status)

        }catch(error){
            setMessage(`Server error ${error}`)
            console.error(error)
        }finally{
            setIsSubmitting(false)
        }
    }



    return(
        <>
          <div class="login-page">

            {/* <!-- Left panel --> */}
            <aside class="left-panel">
                <div class="left-top">
                <div class="left-brand">
                    <span class="left-logo">✦</span>
                    <span class="left-brand-name">Socialynk</span>
                    <span class="left-tag">AI SOCIAL SUITE</span>
                </div>

                <h1>Create once.<br /><span class="muted">Improve with AI.</span><br />Publish everywhere.</h1>

                <p class="left-text">
                    Create, improve, brand, schedule, and publish your social media content from one simple workspace.
                </p>

                <div class="flow-box">
                    <div class="flow-header">
                    <span class="status"><i class="green-dot"></i> Unified Orchestration</span>
                    <span class="delivery">⚡ 99.98% Multi-Network Delivery</span>
                    </div>

                    <div class="step">
                    <span class="step-num">1</span>
                    <div class="step-text">
                        <strong>Create</strong>
                        <small>Draft &amp; Media Assets</small>
                    </div>
                    <span class="step-icon">✎</span>
                    </div>

                    <div class="step active">
                    <span class="step-num">2</span>
                    <div class="step-text">
                        <strong>AI Assist <em>v2.4</em></strong>
                        <small>Smart Hook &amp; Tone Optimization</small>
                    </div>
                    <span class="step-icon">✦</span>
                    </div>

                    <div class="step">
                    <span class="step-num">3</span>
                    <div class="step-text">
                        <strong>Brand</strong>
                        <small>Watermark, Preset &amp; Footers</small>
                    </div>
                    <span class="step-icon">◐</span>
                    </div>

                    <div class="step">
                    <span class="step-num">4</span>
                    <div class="step-text">
                        <strong>Schedule</strong>
                        <small>Optimal AI Time Slots</small>
                    </div>
                    <span class="step-icon">▦</span>
                    </div>

                    <div class="step">
                    <span class="step-num">5</span>
                    <div class="step-text">
                        <strong>Publish</strong>
                        <small>Multi-Channel Sync</small>
                    </div>
                    <span class="mini-tags">
                        <b>X</b><b>in</b><b>ig</b><b>fb</b>
                    </span>
                    </div>
                </div>
                </div>

                <div class="left-footer">
                <span>YOUR SOCIAL MEDIA WORKFLOW, SIMPLIFIED.</span>
                <span>&copy; 2026 Socialynk Inc. All rights reserved.</span>
                </div>
            </aside>

            {/* <!-- Right panel --> */}
            <main class="right-panel">
                <div class="form-wrap">
                <h2>Welcome back</h2>
                <p class="form-sub">Log in to continue managing your social media content with Socialynk.</p>

                <form onSubmit={handleSignIn}>
                    <label for="email">EMAIL ADDRESS</label>
                    <input type="email" id="email" placeholder="alex.chen@socialynk.io" value={email} onChange={(event)=>setEmail(event.target.value)} required/>

                    <label for="password">PASSWORD</label>
                    <div class="password-box">
                    <PasswordInput id="password" placeholder="password1234" value={password} onChange={(event)=>setPassword(event.target.value)} required/>
                    </div>

                    {message && (
                        <div className={"su-message " + (status === 200 || status === 201 ? "success" : "error")}>
                            {message}
                        </div>
                        )}

                    <div class="form-row">
                    <label class="remember">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(event) => setRememberMe(event.target.checked)}
                        /> Remember me
                    </label>
                    <a href="#" 
                        onClick={(e) => {
                            e.preventDefault();
                            setShowForgot(true);
                        }}>Forgot password?</a>

                        {showForgot && (
                            <ForgotPasswordModal onClose={() => setShowForgot(false)} />
                        )}
                    </div>

                    <button type="submit" class="login-btn" disabled={isSubmitting}>{isSubmitting ? "Logging in" : <> login &rarr;</>}</button>

                    <div class="or-line"><span>OR</span></div>

                    <button type="button" class="social-btn">
                    <b class="g-icon">G</b> Continue with Google
                    </button>
                    <button type="button" class="social-btn">
                    <b class="f-icon">f</b> Continue with Facebook
                    </button>

                    <p class="signup-text">Don't have an account? <Link to={"/signup"}>Create an account</Link></p>
                </form>
                </div>

                <div class="right-footer">
                <span>SOC2 Type II Certified &amp; 256-Bit Encrypted</span>
                <div>
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                    <a href="#">System Status</a>
                </div>
                </div>
            </main>

            </div>  
        </>
    )
}

export default LoginPage;