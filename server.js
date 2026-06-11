const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');

app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ limit: '80mb', extended: true }));
app.use(express.static('public'));

function getValidKeys() {
    return Object.keys(process.env)
        .filter(keyName => keyName.startsWith('GEMINI_API_KEY_'))
        .sort((a, b) => {
            const numA = parseInt(a.replace('GEMINI_API_KEY_', ''), 10) || 0;
            const numB = parseInt(b.replace('GEMINI_API_KEY_', ''), 10) || 0;
            return numA - numB;
        })
        .map(keyName => process.env[keyName])
        .filter(val => val && val.trim() !== '');
}

async function executeClusterCall(payload, systemPrompt) {
    const keys = getValidKeys();
    if (keys.length === 0) throw new Error("No API keys found.");

    for (let currentKey of keys) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${currentKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: payload }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] }
                })
            });
            if (response.status === 429) continue;
            const data = await response.json();
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
        } catch (e) { continue; }
    }
    return "Cluster fallback processing threshold breached.";
}

app.post('/api/chat', async (req, res) => {
    try {
        let { text, fileData, mimeType, activePersona, runSimulation, liveFetch } = req.body;

        if (runSimulation) {
            // ADVANCED FEATURE LAYER: Multi-Agent Localized Chain-Reaction Pipeline
            const promptTarget = text || "Optimize the core structural data flow architecture.";
            
            const archPrompt = "You are the Visionary Architect. Take the user's concept and expand it into its absolute highest potential, adding advanced optimizations and premium features.";
            const criticPrompt = "You are the Cynical Critic Red-Team Node. Heavily analyze the provided plan. Expose every hidden flaw, performance bottleneck, data leakage point, and design error brutally.";
            const synthPrompt = "You are the Executive Synthesis Engine. Review the Architect's design and the Critic's brutal breakdown. Reconcile their arguments and output a definitive, flawless, production-ready implementation plan structured with clean markdown sections.";

            const architectureProposal = await executeClusterCall(`User Input Target: ${promptTarget}`, archPrompt);
            const criticCritique = await executeClusterCall(`Analyze this plan: ${architectureProposal}`, criticPrompt);
            
            const massiveSynthesisReport = await executeClusterCall(
                `Original Target: ${promptTarget}\n\n[ARCHITECT PLAN]:\n${architectureProposal}\n\n[CRITIC CRITIQUE]:\n${criticCritique}`, 
                synthPrompt
            );

            const packagedSimulationOutput = `### 🔮 Multi-Agent Simulation Report Matrix\n\n#### 💻 1. The Architect's Vision\n${architectureProposal}\n\n---\n\n#### 🚨 2. The Red-Team Critique\n${criticCritique}\n\n---\n\n#### 🎯 3. Final Converged Solution Blueprint\n${massiveSynthesisReport}`;
            return res.json({ reply: packagedSimulationOutput, sources: [] });
        }

        // Standard Router Fallback Mode 
        const keys = getValidKeys();
        if (keys.length === 0) return res.status(500).json({ error: "Missing pipeline validation keys." });

        // Base Persona & Diagram Logic
        let customSystemInstruction = `You are a frontier-tier AI expert collaborator. Format outputs beautifully using Markdown headers, lists, bold text, and clean Markdown tables. 
        CRITICAL INSTRUCTION FOR VISUALS: If the user asks for a mind map, flowchart, line diagram, or architecture graph, YOU MUST generate it using Mermaid.js syntax. Wrap the Mermaid code exactly inside a \`\`\`mermaid block. Do not just say you created it; write the actual Mermaid diagram code.`;
        
        if (activePersona === 'architect') customSystemInstruction += " Focus purely on advanced software architecture, logic modeling, and bug discovery logs.";
        if (activePersona === 'analyst') customSystemInstruction += " Focus strictly on numeric metrics analytics, tracking grids, and comparative validation tables.";

        // NEW: Live Data / Web Scraping Override
        if (liveFetch) {
            customSystemInstruction = `You are an aggressive Web Scraper and Data Extraction Agent. The user wants LIVE, REAL-TIME DATA from the internet. 
            YOU MUST USE THE GOOGLE SEARCH TOOL to browse the web for exactly what they asked for. 
            If they ask for leads (businesses, emails, phone numbers, contact links), search for them and extract them into a highly organized Markdown Table. Do not invent data. Use real data from the web. Quote your sources.`;
            text = `[EXECUTE LIVE WEB SEARCH & EXTRACTION FOR]: ${text}`;
        }

        let userContentParts = [];
        if (fileData) {
            let cleanMime = mimeType || "image/jpeg";
            userContentParts.push({ inlineData: { mimeType: cleanMime, data: fileData.trim() } });
        }
        userContentParts.push({ text: text || "Process logic analytics block." });

        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${currentKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: userContentParts }],
                        systemInstruction: { parts: [{ text: customSystemInstruction }]},
                        tools: [{ googleSearch: {} }]
                    })
                });
                if (response.status === 429) continue;
                const data = await response.json();
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                    let botReply = data.candidates[0].content.parts[0].text;
                    let sources = [];
                    const metadata = data.candidates[0].groundingMetadata;
                    if (metadata && metadata.groundingChunks) {
                        sources = metadata.groundingChunks
                            .filter(chunk => chunk.web && chunk.web.uri)
                            .map(chunk => ({ title: chunk.web.title || "Source", url: chunk.web.uri }));
                    }
                    return res.json({ reply: botReply, sources: sources });
                }
            } catch (err) { continue; }
        }
        return res.json({ reply: "API cluster pipeline rate-limit congestion. Try trimming session context cache blocks.", sources: [] });
    } catch (globalError) {
        res.status(500).json({ error: "Advanced router encountered a parameters execution collision." });
    }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running.");
});
