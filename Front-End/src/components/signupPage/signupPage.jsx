import { Link } from "react-router-dom";
import "./signupPage.css"
import { useState } from "react";
import api from "../../api/api.js"
import { useNavigate } from "react-router-dom";

function SignupPage(){

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [message, setMessage] = useState("")
    const [status, setStatus] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [termsError, setTermsError] = useState("")

    const navigate = useNavigate()

    const handleCreateAccount = async (event)=>{

        event.preventDefault()
        if (!acceptedTerms) {
            setTermsError("Please accept the terms and conditions.")
            return
        }

        setIsSubmitting(true)
        setMessage("")
        setTermsError("")

        try{
            const response = await api.post("/user/signup", {
                    fullname: name,
                    email,
                    password,
                    confirmPassword,
                }, {
                    validateStatus: () => true,
            })

            const result = response.data
            setStatus(response.status);
            setMessage(result.message ?? result.error ?? "Unable to create account.")

            navigate("/login", {replace: true})

            if (response.ok){
                setName("")
                setEmail("")
                setPassword("")
                setConfirmPassword("")
            }

        }catch(error){
            console.error(error)
            setStatus(500)
            setMessage("Something went wrong. Please try again...")
            
        }finally{
            setIsSubmitting(false)
        }

    }
    return(
        <>
            <div class="su-page">

                {/* <!-- Left panel --> */}
                <aside class="su-left">
                    <div>
                    <div class="su-top">
                        <div class="su-brand">
                        <span class="su-logo">✦</span>
                        <span class="su-brand-name">Socialynk</span>
                        <span class="su-tag">AI SOCIAL SUITE</span>
                        </div>
                        <span class="su-live"><i></i> v2.4 Live</span>
                    </div>

                    <h1>Create your Socialynk workspace.</h1>
                    <p class="su-left-text">
                        Create content, improve it with AI, add your branding, and manage your social media publishing from one simple workspace.
                    </p>

                    <div class="su-image-box">
                        <img src="https://picsum.photos/720/300?grayscale" alt="Preview image" />
                    </div>
                    </div>

                    <div class="su-left-footer">
                    <span>Everything you need to manage your social content.</span>
                    <span class="mono">&copy; 2026 Socialynk Inc. All rights reserved.</span>
                    </div>
                </aside>

                {/* <!-- Right panel --> */}
                <main class="su-right">
                    <p class="su-login-link">Already have an account? <Link to={"/login"}>Log in</Link></p>

                    <div class="su-form-wrap">
                    <h2>Create your account</h2>
                    <p class="su-sub">Start creating and managing your social media content with Socialynk.</p>

                    <form onSubmit={handleCreateAccount} onInvalid={()=>{
                        if (!acceptedTerms) {
                            setTermsError("Please accept the terms and conditions.")
                        }
                    }}>
                        <label for="name">FULL NAME</label>
                        <div class="su-field">
                        <input type="text" id="name" placeholder="Alex pandiyan" value={name} onChange={(event)=>setName(event.target.value)} required/>
                        <span class="su-field-icon">&#9786;</span>
                        </div>

                        <label for="email">EMAIL ADDRESS</label>
                        <div class="su-field">
                        <input type="email" id="email" placeholder="alex@socialynk.io" value={email} onChange={(event)=>setEmail(event.target.value)} required/>
                        <span class="su-field-icon">&#9993;</span>
                        </div>

                        <label for="password">PASSWORD</label>
                        <div class="su-field">
                        <input type="password" id="password" placeholder="password123" value={password} onChange={(event)=>setPassword(event.target.value)} required/>
                        <span class="su-field-icon">&#9673;</span>
                        </div>

                        {/* <div class="su-strength-head">
                        <span>Password strength</span>
                        <b class="su-strong">STRONG</b>
                        </div>
                        <div class="su-bars">
                        <i></i><i></i><i></i><i></i>
                        </div>

                        <ul class="su-rules">
                        <li>At least 8 characters</li>
                        <li>One uppercase letter</li>
                        <li>One number</li>
                        <li>One special character</li>
                        </ul> */}

                        <label for="confirm">CONFIRM PASSWORD</label>
                        <div class="su-field">
                        <input type="password" id="confirm" placeholder="password123" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} required/>
                        <span class="su-field-icon">&#9673;</span>
                        </div>

                        <label className="su-agree" htmlFor="accepted-terms">
                        <input
                            id="accepted-terms"
                            type="checkbox"
                            checked={acceptedTerms}
                            aria-invalid={termsError ? "true" : "false"}
                            aria-describedby={termsError ? "terms-error" : undefined}
                            onChange={(event)=>{
                                setAcceptedTerms(event.target.checked)
                                if (event.target.checked) {
                                    setTermsError("")
                                }
                            }}
                        />
                        I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                        </label>

                        {termsError && (
                        <div id="terms-error" className="su-message error" role="alert">
                            {termsError}
                        </div>
                        )}

                        {message && (
                        <div className={"su-message " + (status === 200 || status === 201 ? "success" : "error")}>
                            {message}
                        </div>
                        )}

                        <button type="submit" class="su-btn-main" disabled={isSubmitting}>{isSubmitting ? "Creating account..." : <>Create Account &rarr;</>}</button>

                        <div class="su-or"><span>OR</span></div>

                        <div class="su-social-row">
                        <button type="button" class="su-social"><b class="g">G</b> Continue with Google</button>
                        <button type="button" class="su-social"><b class="f">f</b> Continue with Facebook</button>
                        </div>
                    </form>
                    </div>

                    <div class="su-right-footer">
                    <span>&#9737; SOC2 Type II Certified &amp; 256-Bit Encrypted</span>
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

export default SignupPage;