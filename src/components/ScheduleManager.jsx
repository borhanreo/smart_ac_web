import React, { useState, useEffect } from "react";
export default function ScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState("");
  useEffect(() => { const saved = JSON.parse(localStorage.getItem("schedules")) || []; setSchedules(saved); }, []);
  const saveSchedules = (updated) => { localStorage.setItem("schedules", JSON.stringify(updated)); setSchedules(updated); };
  const addSchedule = () => { if (newSchedule.trim()) { const updated = [...schedules, { time: newSchedule }]; saveSchedules(updated); setNewSchedule(""); } };
  const deleteSchedule = (index) => { const updated = schedules.filter((_, i) => i !== index); saveSchedules(updated); };
  return (<div className="panel"><h3>Schedules</h3>
    <input placeholder="HH:MM format" value={newSchedule} onChange={(e) => setNewSchedule(e.target.value)} />
    <button onClick={addSchedule}>Add</button>
    <ul>{schedules.map((s,i) => (<li key={i}>{s.time}<button onClick={() => deleteSchedule(i)}>❌</button></li>))}</ul></div>);
}