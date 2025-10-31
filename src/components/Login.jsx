import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleLogin = async () => {
    try { const userCred = await signInWithEmailAndPassword(auth, email, password); onLogin(userCred.user); }
    catch (err) { setError(err.message); }
  };
  return (<div className="login-container"><h2>AC Controller Login</h2>
  <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
  <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
  <button onClick={handleLogin}>Login</button>{error && <p className="error">{error}</p>}</div>);
}