document.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
        const output = document.getElementById("output");
        const lang = document.getElementById("language").value;
        output.textContent = `Generating ${btn.id}...`;

        //get user's api key
        chrome.storage.sync.get(["geminiApiKey"], ({geminiApiKey}) => {
            if(!geminiApiKey){
                output.textContent = "No API key set, click the gear icon to add one.";
                return;
            }
            //content.js -> problem
            chrome.tabs.query({active:true,currentWindow:true}, ([tab]) =>{
                if (!tab || !tab.id) {
                    output.textContent = "No active tab found.";
                    return;
                }

                try {
                    const url = new URL(tab.url);
                    if (url.hostname !== "leetcode.com" && url.hostname !== "www.leetcode.com") {
                        output.textContent = "This extension only works on LeetCode problem pages.";
                        return;
                    }
                } catch (e) {
                    output.textContent = "Invalid tab URL.";
                    return;
                }

                chrome.tabs.sendMessage(
                    tab.id,
                    { action: "getProblem" },
                    async(response) => {
                        if (chrome.runtime.lastError) {
                            output.textContent = "Please reload the page";
                            return;
                        }
                        if (!response) {
                            output.textContent = "No response from content script.";
                            return;
                        }
                        const { problem } = response;
                        if (!problem) {
                            output.textContent = "Couldn't extract text from this page.";
                            return;
                        }
                        //Send problem to gemini and get solution
                        try {
                            const answer = await getGeminiSolution(problem, btn.id, lang, geminiApiKey);
                            output.textContent = answer;
                        } catch (error) {
                            output.textContent = "Gemini Error: " + error.message;
                        }
                    }
                );
            });
        });
    });
});

async function getGeminiSolution(problem, type, lang, apiKey){
    const promptMap = {
        hint: `${problem}\n\n Give only 3 hints to help solve the problem`,
        approach: `${problem}\n\n Explain the approach using one of the test case but not the exact code`,
        brute: `${problem}\n\n Give the brute force approach and code in ${lang} to help solve the problem`,
        optimized: `${problem}\n\n Give the optimized approach and code in ${lang} to help solve the problem`
    }

    const prompt = promptMap[type] || promptMap.hint;


    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                contents: [{parts: [{text: prompt}]}],
                generationConfig: {temperature: 0.2}
            })
        }
    )

    if(!res.ok) {
        const {error} = await res.json();
        throw new Error(error?.message || "Request failed");
    }

    const data = await res.json();
    // console.log(data);
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No solution";
}

