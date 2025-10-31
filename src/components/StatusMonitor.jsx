import React from "react";
export default function StatusMonitor({ mqttData }) { return (<div className="panel"><h3>Device Status</h3><pre>{JSON.stringify(mqttData,null,2)}</pre></div>); }