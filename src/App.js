import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Icon Components ---

const IconSpinner = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const IconPlay = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);

const IconPause = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
);

const IconFullscreenEnter = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
);

const IconFullscreenExit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
);


// --- Helper Functions and Constants ---

const readingLevels = [
  "Pre-Primer", "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade",
  "4th Grade", "5th Grade", "6th Grade", "7th Grade", "8th Grade",
  "9th Grade", "10th Grade", "11th Grade", "12th Grade"
];

const genres = ["Fiction", "Non-Fiction"];

const questionTypes = [
  { id: 'explicit', label: 'Explicit Comprehension' },
  { id: 'implicit', label: 'Implicit Comprehension' },
  { id: 'evaluative', label: 'Evaluative Comprehension' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'mainIdea', label: 'Main Idea' },
  { id: 'authorsPurpose', label: "Author's Purpose" },
  { id: 'textStructure', label: 'Text Structure' },
];

const questionOrder = ['explicit', 'vocabulary', 'mainIdea', 'authorsPurpose', 'textStructure', 'evaluative', 'implicit'];

// --- Audio Helper Functions ---

/**
 * Converts a base64 string to an ArrayBuffer.
 * @param {string} base64 The base64 string to convert.
 * @returns {ArrayBuffer}
 */
const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

/**
 * Converts raw PCM audio data to a WAV file Blob.
 * @param {Int16Array} pcmData The raw PCM data.
 * @param {number} sampleRate The sample rate of the audio.
 * @returns {Blob} A Blob representing the WAV file.
 */
const pcmToWav = (pcmData, sampleRate) => {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // Bits per sample
    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(44 + i * 2, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
};


// --- Main App Component ---

export default function App() {
  const [screen, setScreen] = useState('setup'); // 'setup', 'assessment', 'results'
  const [studentName, setStudentName] = useState('');
  const [readingLevel, setReadingLevel] = useState(readingLevels[2]);
  const [genre, setGenre] = useState(genres[0]);
  const [topics, setTopics] = useState('');
  const [questionCounts, setQuestionCounts] = useState(
    questionTypes.reduce((acc, type) => ({ ...acc, [type.id]: 0 }), {})
  );
  const [assessmentData, setAssessmentData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isQuestionAudioLoading, setIsQuestionAudioLoading] = useState(false);
  const [passageAudioUrl, setPassageAudioUrl] = useState(null);
  const [questionAudioUrls, setQuestionAudioUrls] = useState({});
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatePassageAudio, setGeneratePassageAudio] = useState(true);
  const [generateQuestionAudio, setGenerateQuestionAudio] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        setError("Fullscreen mode is not permitted in this view.");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  useEffect(() => {
    if (error) {
        const timeoutId = setTimeout(() => setError(null), 5000);
        return () => clearTimeout(timeoutId);
    }
  }, [error]);

  const highlightVocabWords = (passage, wordsToBold) => {
    if (!wordsToBold || wordsToBold.length === 0) {
        return passage;
    }
    const regex = new RegExp(`\\b(${wordsToBold.join('|')})\\b`, 'gi');
    return passage.replace(regex, '<strong class="text-cyan-400">$1</strong>');
  };

  const handleGenerateProbe = async () => {
    const totalQuestions = Object.values(questionCounts).reduce((sum, count) => sum + (parseInt(count, 10) || 0), 0);
    if (totalQuestions === 0) {
      setError("Please select at least one question to generate.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setPassageAudioUrl(null);
    setQuestionAudioUrls({});

    const systemPrompt = `
      You are an expert in creating educational reading comprehension assessments.
      Your task is to generate a reading passage and a set of multiple-choice questions based on the provided parameters.
      The passage must be original, engaging, and appropriate for the specified reading level and genre.
      The passage should be well-structured with multiple paragraphs. Separate each paragraph with a double newline character (\\n\\n).
      Each question must have exactly four answer choices (A, B, C, D), with one clearly correct answer.
      For vocabulary questions, you MUST include the "vocabularyWord" property.
      Crucially, the wording of each question must be simple and clear enough for a student at the specified reading level to understand. For lower grade levels (e.g., 1st Grade), avoid complex vocabulary like 'passage' or 'described'; instead, use simpler phrasing like 'in the reading' or 'what does the story say about'.
      The output must be a single JSON object.
    `;

    const userQuery = `
      Generate a reading comprehension probe with the following specifications:
      - Reading Level: ${readingLevel}
      - Genre: ${genre}
      - Topics of Interest: ${topics || 'a random, age-appropriate topic'}
      - Number of Explicit Comprehension questions: ${questionCounts.explicit}
      - Number of Implicit Comprehension questions: ${questionCounts.implicit}
      - Number of Evaluative Comprehension questions: ${questionCounts.evaluative}
      - Number of Vocabulary questions: ${questionCounts.vocabulary}
      - Number of Main Idea questions: ${questionCounts.mainIdea}
      - Number of Author's Purpose questions: ${questionCounts.authorsPurpose}
      - Number of Text Structure questions: ${questionCounts.textStructure}

      Return the result as a single JSON object with two keys: "passage" (a string) and "questions" (an array of objects).
      Each question object in the array should have the following properties:
      - "type": (string, one of 'explicit', 'implicit', 'evaluative', 'vocabulary', 'mainIdea', 'authorsPurpose', 'textStructure')
      - "questionText": (string)
      - "choices": (an array of 4 strings)
      - "correctAnswer": (string, the exact text of the correct choice)
      - "vocabularyWord": (string, ONLY for questions of type 'vocabulary'. This should be the single word from the passage that the question is about.)
    `;
    
    try {
        const apiKey = "AIzaSyDbyFRosCckpHMGRRmA4hSpvSeJhPiSQuA";
        const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
        };

        const response = await fetch(textApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);

        const result = await response.json();
        const jsonText = result.candidates[0].content.parts[0].text;
        const data = JSON.parse(jsonText);

        if (!data || !Array.isArray(data.questions)) {
            console.error("Invalid data structure from API:", data);
            throw new Error("The API returned an unexpected response format. Please try generating the probe again.");
        }
        
        const sortedQuestions = data.questions.sort((a, b) => questionOrder.indexOf(a.type) - questionOrder.indexOf(b.type));
        
        const vocabWords = sortedQuestions
            .filter(q => q.type === 'vocabulary' && q.vocabularyWord)
            .map(q => q.vocabularyWord);

        const highlightedPassage = highlightVocabWords(data.passage, vocabWords);

        setAssessmentData({ ...data, passage: highlightedPassage, questions: sortedQuestions });
        setUserAnswers({});
        setScreen('assessment');
        setIsLoading(false);
        
        // --- Conditionally generate audio ---
        const ttsApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

        if (generatePassageAudio) {
            setIsAudioLoading(true);
            try {
                const ttsPayload = {
                    contents: [{ parts: [{ text: data.passage }] }],
                    generationConfig: { 
                        responseModalities: ["AUDIO"]
                    },
                    model: "gemini-2.5-flash-preview-tts"
                };
                const ttsResponse = await fetch(ttsApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload) });
                if (!ttsResponse.ok) throw new Error(`Passage TTS API call failed`);
                const ttsResult = await ttsResponse.json();
                const audioData = ttsResult?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                const mimeType = ttsResult?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
                if (audioData && mimeType?.startsWith("audio/")) {
                    const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
                    const pcmData = base64ToArrayBuffer(audioData);
                    const pcm16 = new Int16Array(pcmData);
                    const wavBlob = pcmToWav(pcm16, sampleRate);
                    setPassageAudioUrl(URL.createObjectURL(wavBlob));
                }
            } catch (err) {
                console.error("Error generating passage audio:", err);
                setError("Could not generate passage audio.");
            } finally {
                setIsAudioLoading(false);
            }
        }

        if (generateQuestionAudio) {
            setIsQuestionAudioLoading(true);
            try {
                const audioPromises = sortedQuestions.map(async (q, index) => {
                    const textToRead = `Question ${index + 1}. ${q.questionText}. Option A, ${q.choices[0]}. Option B, ${q.choices[1]}. Option C, ${q.choices[2]}. Option D, ${q.choices[3]}.`;
                    const ttsPayload = {
                        contents: [{ parts: [{ text: textToRead }] }],
                        generationConfig: { 
                            responseModalities: ["AUDIO"]
                        },
                        model: "gemini-2.5-flash-preview-tts"
                    };
                    const ttsResponse = await fetch(ttsApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload) });
                    if (!ttsResponse.ok) return null;
                    const ttsResult = await ttsResponse.json();
                    const audioData = ttsResult?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    const mimeType = ttsResult?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
                    if (audioData && mimeType?.startsWith("audio/")) {
                        const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
                        const pcmData = base64ToArrayBuffer(audioData);
                        const pcm16 = new Int16Array(pcmData);
                        const wavBlob = pcmToWav(pcm16, sampleRate);
                        return URL.createObjectURL(wavBlob);
                    }
                    return null;
                });
                const urls = await Promise.all(audioPromises);
                const urlsObject = urls.reduce((acc, url, index) => {
                    if (url) acc[index] = url;
                    return acc;
                }, {});
                setQuestionAudioUrls(urlsObject);
            } catch (err) {
                console.error("Error generating question audio:", err);
                setError("Could not generate question audio.");
            } finally {
                setIsQuestionAudioLoading(false);
            }
        }

    } catch (err) {
        console.error("Error during generation process:", err);
        setError("Failed to generate the reading probe. Please try again.");
        setIsLoading(false);
        setIsAudioLoading(false);
        setIsQuestionAudioLoading(false);
    }
  };

  const handleSubmitAnswers = () => {
    setScreen('results');
  };

  const handleCopyResults = (setCopyButtonText) => {
    const scores = calculateScores();
    let reportText = `Reading Comprehension Probe Results\n\n`;
    reportText += `Date: ${new Date().toLocaleDateString()}\n`;
    reportText += `Student: ${studentName || 'N/A'}\n`;
    reportText += `Reading Level: ${readingLevel}\n`;
    reportText += `Genre: ${genre}\n\n`;
    reportText += "Scores by Category\n";
    reportText += "--------------------\n";

    let totalCorrect = 0;
    let totalQuestions = 0;

    questionTypes.forEach(qType => {
        if (scores[qType.id].total > 0) {
            reportText += `${qType.label}: ${scores[qType.id].correct}/${scores[qType.id].total} (${scores[qType.id].percentage}%)\n`;
            totalCorrect += scores[qType.id].correct;
            totalQuestions += scores[qType.id].total;
        }
    });
    
    const totalPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    reportText += `\n--------------------\n`;
    reportText += `Total Score: ${totalCorrect}/${totalQuestions} (${totalPercentage}%)`;

    // Fallback for environments that block navigator.clipboard
    const textArea = document.createElement("textarea");
    textArea.value = reportText;
    textArea.style.position = "fixed"; // Avoid scrolling to bottom
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Results'), 2000);
        } else {
            setError('Could not copy results to clipboard.');
        }
    } catch (err) {
        console.error('Failed to copy results: ', err);
        setError('Could not copy results to clipboard.');
    }
    document.body.removeChild(textArea);
  };

  const calculateScores = useCallback(() => {
    const scores = {};
    questionTypes.forEach(qType => {
        scores[qType.id] = { correct: 0, total: 0, percentage: 0 };
    });

    if (!assessmentData) return scores;

    assessmentData.questions.forEach((q, index) => {
        const type = q.type;
        if (scores[type]) {
            scores[type].total += 1;
            // FIX: Trim whitespace from both the user's answer and the correct answer for a more reliable comparison.
            if (userAnswers[index]?.trim() === q.correctAnswer?.trim()) {
                scores[type].correct += 1;
            }
        }
    });

    questionTypes.forEach(qType => {
        const { correct, total } = scores[qType.id];
        scores[qType.id].percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    });

    return scores;
  }, [assessmentData, userAnswers]);

  const renderScreen = () => {
    switch (screen) {
      case 'assessment':
        return <AssessmentScreen 
                    assessmentData={assessmentData} 
                    userAnswers={userAnswers}
                    setUserAnswers={setUserAnswers}
                    onSubmit={handleSubmitAnswers} 
                    passageAudioUrl={passageAudioUrl}
                    isAudioLoading={isAudioLoading}
                    questionAudioUrls={questionAudioUrls}
                    isQuestionAudioLoading={isQuestionAudioLoading}
                />;
      case 'results':
        return <ResultsScreen 
                    assessmentData={assessmentData} 
                    userAnswers={userAnswers}
                    scores={calculateScores()}
                    onCopyResults={handleCopyResults}
                    onRestart={() => setScreen('setup')}
                    passageAudioUrl={passageAudioUrl}
                    questionAudioUrls={questionAudioUrls}
                />;
      case 'setup':
      default:
        return <SetupScreen
                    studentName={studentName}
                    setStudentName={setStudentName}
                    readingLevel={readingLevel}
                    setReadingLevel={setReadingLevel}
                    genre={genre}
                    setGenre={setGenre}
                    topics={topics}
                    setTopics={setTopics}
                    questionCounts={questionCounts}
                    setQuestionCounts={setQuestionCounts}
                    onGenerate={handleGenerateProbe}
                    isLoading={isLoading}
                    generatePassageAudio={generatePassageAudio}
                    setGeneratePassageAudio={setGeneratePassageAudio}
                    generateQuestionAudio={generateQuestionAudio}
                    setGenerateQuestionAudio={setGenerateQuestionAudio}
                />;
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-300 relative">
      <button 
        onClick={toggleFullscreen}
        className="absolute top-4 left-4 z-10 p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition text-slate-200"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <IconFullscreenExit /> : <IconFullscreenEnter />}
      </button>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <img src="https://raw.githubusercontent.com/navasdo/oliver/7205ea0bd0559cbee014875505a16d7a3b5dec21/Navacite.png" alt="Navacite Logo" className="w-48 mx-auto mb-4"/>
          <h1 className="text-4xl font-bold text-cyan-400">Reading Comprehension Probe Generator <sup>v1.0</sup></h1>
          <p className="text-sm text-slate-400 italic mt-2">Concept by Daniel Navas, M.A., CCC-SLP & Coded in Tandem with Google Gemini</p>
        </header>
        {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-lg text-center my-4 max-w-4xl mx-auto">{error}</div>}
        <main className="bg-slate-800/50 p-6 sm:p-8 rounded-2xl shadow-lg max-w-4xl mx-auto border border-slate-700">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

// --- Screen Components ---

const SetupScreen = ({ studentName, setStudentName, readingLevel, setReadingLevel, genre, setGenre, topics, setTopics, questionCounts, setQuestionCounts, onGenerate, isLoading, generatePassageAudio, setGeneratePassageAudio, generateQuestionAudio, setGenerateQuestionAudio }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const handleCountChange = (typeId, value) => {
    const newCount = Math.max(0, parseInt(value, 10) || 0);
    setQuestionCounts(prev => ({ ...prev, [typeId]: newCount }));
  };

  return (
    <div className="space-y-8">
      <div className="text-center p-3 bg-slate-700 text-cyan-300 rounded-lg">
        <p className="font-semibold">{currentDate}</p>
      </div>
      <div className="space-y-6">
        <div>
          <label htmlFor="studentName" className="block text-lg font-medium text-slate-300 mb-2">Student Name or Initials</label>
          <input type="text" id="studentName" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-slate-200" placeholder="e.g., J.D. or Jane Doe" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="readingLevel" className="block text-lg font-medium text-slate-300 mb-2">Reading Level</label>
            <select id="readingLevel" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-slate-200">
              {readingLevels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="passageGenre" className="block text-lg font-medium text-slate-300 mb-2">Passage Genre</label>
            <select id="passageGenre" value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-slate-200">
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="topics" className="block text-lg font-medium text-slate-300 mb-2">Topics of Interest (Optional)</label>
          <input type="text" id="topics" value={topics} onChange={(e) => setTopics(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-slate-200" placeholder="e.g., dinosaurs, space exploration" />
        </div>
      </div>
      <div className="border-t border-slate-700 pt-6">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Assessment Questions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {questionTypes.map(qType => (
            <div key={qType.id}>
              <label htmlFor={qType.id} className="block text-md font-medium text-slate-400 mb-1">{qType.label}</label>
              <input type="number" id={qType.id} min="0" value={questionCounts[qType.id]} onChange={(e) => handleCountChange(qType.id, e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-700 pt-6">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Audio Options</h2>
        <div className="space-y-4">
            <label className="flex items-center p-3 rounded-md hover:bg-slate-700/50 transition cursor-pointer">
                <input type="checkbox" checked={generatePassageAudio} onChange={(e) => setGeneratePassageAudio(e.target.checked)} className="h-5 w-5 rounded text-cyan-500 focus:ring-cyan-500 border-slate-600 bg-slate-700" />
                <span className="ml-4 text-md text-slate-300">Generate audio for passage</span>
            </label>
            <label className="flex items-center p-3 rounded-md hover:bg-slate-700/50 transition cursor-pointer">
                <input type="checkbox" checked={generateQuestionAudio} onChange={(e) => setGenerateQuestionAudio(e.target.checked)} className="h-5 w-5 rounded text-cyan-500 focus:ring-cyan-500 border-slate-600 bg-slate-700" />
                <span className="ml-4 text-md text-slate-300">Generate audio for questions and answers</span>
            </label>
        </div>
      </div>
      <div className="text-center pt-4">
        <button onClick={onGenerate} disabled={isLoading} className="w-full md:w-auto px-12 py-4 bg-cyan-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-400/50 transition-transform transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <IconSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Generating...
            </div>
          ) : 'Generate Probe'}
        </button>
      </div>
    </div>
  );
};

const AudioPlayer = ({ audioUrl, isLoading }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.onended = () => setIsPlaying(false);
        }
    }, [audioUrl]);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center w-10 h-10">
                <IconSpinner className="animate-spin h-5 w-5 text-slate-400" />
            </div>
        );
    }

    if (!audioUrl) return <div className="w-10 h-10"></div>; // Placeholder for alignment

    return (
        <div className="flex items-center w-10 h-10">
            <audio ref={audioRef} src={audioUrl} preload="auto"></audio>
            <button onClick={togglePlayPause} className="p-2 rounded-full bg-cyan-600 text-white hover:bg-cyan-700 transition">
                {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
        </div>
    );
};


const AssessmentScreen = ({ assessmentData, userAnswers, setUserAnswers, onSubmit, passageAudioUrl, isAudioLoading, questionAudioUrls, isQuestionAudioLoading }) => {
  if (!assessmentData) {
    return <div className="text-center p-8">Loading assessment...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-2 mb-4">
            <h2 className="text-2xl font-semibold text-slate-200">Reading Passage</h2>
            <AudioPlayer audioUrl={passageAudioUrl} isLoading={isAudioLoading} />
        </div>
        <div className="prose prose-invert max-w-none text-lg leading-relaxed">
            {assessmentData.passage.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-slate-300" style={{ textIndent: '2em' }} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold border-b-2 border-slate-700 pb-2 mb-6 text-slate-200">Assessment Questions</h2>
        <div className="space-y-8">
          {assessmentData.questions.map((q, index) => (
            <div key={index} className="bg-slate-900/50 p-6 rounded-lg">
              <div className="flex items-start mb-4">
                <AudioPlayer audioUrl={questionAudioUrls[index]} isLoading={isQuestionAudioLoading && !questionAudioUrls[index]} />
                <p className="text-lg font-semibold ml-3 flex-1 text-slate-200">{index + 1}. {q.questionText}</p>
              </div>
              <div className="space-y-3 pl-12">
                {q.choices.map((choice, choiceIndex) => (
                  <label key={choiceIndex} className="flex items-center p-3 rounded-md hover:bg-slate-700/50 transition cursor-pointer">
                    <input type="radio" name={`question-${index}`} value={choice} checked={userAnswers[index] === choice} onChange={() => setUserAnswers(prev => ({ ...prev, [index]: choice }))} className="h-5 w-5 text-cyan-500 focus:ring-cyan-500 border-slate-600 bg-slate-700" />
                    <span className="ml-4 text-md text-slate-300">{choice}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center pt-6">
        <button onClick={onSubmit} className="w-full md:w-auto px-12 py-4 bg-green-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-400/50 transition-transform transform hover:scale-105">
          Submit Answers
        </button>
      </div>
    </div>
  );
};

const ResultsScreen = ({ assessmentData, userAnswers, scores, onCopyResults, onRestart, passageAudioUrl, questionAudioUrls }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy Results');
  
  return (
    <div className="space-y-10">
      <h2 className="text-3xl font-bold text-center text-slate-200">Assessment Results</h2>
      
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-2 mb-4">
            <h3 className="text-2xl font-semibold text-slate-200">Reading Passage</h3>
            <AudioPlayer audioUrl={passageAudioUrl} isLoading={false} />
        </div>
        <div className="prose prose-invert max-w-none text-lg leading-relaxed bg-slate-900/50 p-6 rounded-lg">
            {assessmentData.passage.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-slate-300" style={{ textIndent: '2em' }} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ))}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold border-b-2 border-slate-700 pb-2 mb-6 text-slate-200">Question Review</h3>
        <div className="space-y-8">
          {assessmentData.questions.map((q, index) => {
            return (
              <div key={index} className="bg-slate-900/50 p-6 rounded-lg">
                <div className="flex items-start mb-4">
                    <AudioPlayer audioUrl={questionAudioUrls[index]} isLoading={false} />
                    <p className="text-lg font-semibold ml-3 flex-1 text-slate-200">{index + 1}. {q.questionText}</p>
                </div>
                <div className="space-y-3 pl-12">
                  {q.choices.map((choice, choiceIndex) => {
                    let highlightClass = 'border-slate-700';
                    if (choice === q.correctAnswer) {
                      highlightClass = 'bg-green-500/20 border-green-500';
                    } else if (choice === userAnswers[index]) {
                      highlightClass = 'bg-red-500/20 border-red-500';
                    }
                    return (
                      <div key={choiceIndex} className={`p-3 rounded-md border-2 ${highlightClass}`}>
                        <span className="text-md text-slate-200">{choice}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-700 pt-8">
        <h3 className="text-2xl font-semibold text-center mb-4 text-slate-200">Scores</h3>
        <div className="max-w-md mx-auto bg-slate-900/50 p-6 rounded-lg space-y-3">
          {questionTypes.map(qType => {
            if (scores[qType.id] && scores[qType.id].total > 0) {
              const score = scores[qType.id];
              return (
                <div key={qType.id} className="flex justify-between items-center text-lg">
                  <span className="font-medium text-slate-300">{qType.label}:</span>
                  <span className="font-bold text-cyan-400">({score.correct}/{score.total}) = {score.percentage}%</span>
                </div>
              );
            }
            return null;
          })}
          <div className="border-t border-slate-700 my-3"></div>
           <div className="flex justify-between items-center text-xl font-bold pt-2">
             <span className="text-slate-200">Total Score:</span>
             <span className="text-cyan-400">
               ({Object.values(scores).reduce((acc, s) => acc + s.correct, 0)}/{Object.values(scores).reduce((acc, s) => acc + s.total, 0)})
               = {
                   (() => {
                       const totalCorrect = Object.values(scores).reduce((acc, s) => acc + s.correct, 0);
                       const totalQuestions = Object.values(scores).reduce((acc, s) => acc + s.total, 0);
                       return totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
                   })()
               }%
             </span>
           </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
        <button onClick={onRestart} className="w-full sm:w-auto px-12 py-4 bg-slate-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-400/50 transition-transform transform hover:scale-105">
          Create New Probe
        </button>
        <button onClick={() => onCopyResults(setCopyButtonText)} className="w-full sm:w-auto px-12 py-4 bg-indigo-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-400/50 transition-transform transform hover:scale-105">
          {copyButtonText}
        </button>
      </div>
    </div>
  );
};
