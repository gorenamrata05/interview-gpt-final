import { useState, useEffect, useRef } from 'react';
import './App.css';
import OpenAI from 'openai';

interface ISpeechRecognition extends EventTarget {
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: any;
}

type CustomSpeechRecognition = SpeechRecognition & {
  continuous: boolean;
  interimResults: boolean;
};

declare global {
  interface Window {
    SpeechRecognition: {
      new (): ISpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): ISpeechRecognition;
    };
  }
}
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});
interface Feedback {
  feedback: string;
  correctness: number;
  completeness: number;
}
function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedbackLoadingStatus, setFeedbackLoadingStatus] = useState(false);
  const [questionStatus, setQuestionStatus] = useState(true);
  const [question, setQuestion] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

  useEffect(() => {

   

    getQuestion();
let tempTranscript = '';

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition() as CustomSpeechRecognition;
    (recognition as any).continuous = false;
    (recognition as any).interimResults = false;
    (recognition as any).lang = 'en-US';
    (recognition as any).start();
    (recognition as any).onresult = (e: any) => {
      const tempTranscript = e.results[e.resultIndex][0].transcript;
      setTranscript(tempTranscript);
    };
 if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      return;
    }
  (recognition as any).onend = () => {
  setIsListening(false);
  if (tempTranscript.trim().length > 0) {
    getFeedback();
  }
};

    recognitionRef.current = recognition;
  }, []);

  const getQuestion = async () => {
    setQuestionStatus(true);
    setFeedback(null);
    try {
      const completion = await openai.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI interview coach. Just generate a random technical JavaScript interview question. No explanation.',
          },
        ],
      });

      const generated = completion.choices[0]?.message?.content?.trim();
      if (generated) {
        setQuestion(generated);
      }
    } catch (err) {
      console.error('Error generating question:', err);
    } finally {
      setQuestionStatus(false);
    }
  };

  function extractJSON(text: any) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error("Invalid JSON:", e);
    }
  }
  return null;
}

  const getFeedback = async () => {
    setFeedbackLoadingStatus(true);
    try {
      const completion = await openai.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          {
            role: 'system',
            content: 'You are an AI interview evaluator.',
          },
          {
            role: 'user',
            content: `You are an expert interviewer. Evaluate the following answer to a JavaScript interview question. 
            Question: ${question}
            Candidate's Answer: ${transcript}
            Evaluate the user's answer and return a JSON object:
            {
              "correctness": <a number from 0 to 5>,
              "completeness": <a number from 0 to 5>,
              "feedback": "Detailed feedback of around 150 words based on the answer"
            }`,
          },
        ],
      });
      const responseText: any = completion.choices[0]?.message?.content;
      if (responseText) {
        const parsed = extractJSON(responseText);
        if (parsed) {
          setFeedback(parsed);
        } else {
          console.warn("Could not parse JSON from GPT response:", responseText);
        }
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      alert('Something went wrong while fetching feedback.');
    } finally {
      setFeedbackLoadingStatus(false);
    }
  };

  const handleStartListening = () => {
    setIsListening(true);
    setTranscript('');
    recognitionRef.current?.start();
  };

  const handleStopListening = async () => {
    setIsListening(false);
    recognitionRef.current?.stop();
    await getFeedback();
  };

  const handleReattempt = () => {
    setFeedback(null);
    setTranscript('');
    handleStartListening();
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      <div className={`max-w-4xl mx-auto ${feedbackLoadingStatus || feedback ? 'flex' : ''}`}>
        <div
          className={`${
            feedbackLoadingStatus || feedback ? 'w-1/2 h-screen' : 'max-w-xl text-center'
          }`}
        >
          <p className="text-[24px] font-semibold mt-24 mr-2  {feedback.feedback ? 'border-r' : ''}">
            {questionStatus ? 'Loading question...' : question}
          </p>
          <p className="mt-10">Record your answer</p>
          <p className="text-sm text-neutral-700 mb-5">Try to answer</p>
          <span
            className={`${
              isListening ? 'bg-black text-white' : 'bg-blue-500 text-white' } p-3 cursor-pointer ${feedback ? 'hidden' : ''} `}
            onClick={isListening ? handleStopListening : handleStartListening}
          >
            {isListening ? 'Submit Answer' : 'Start Answering'}
          </span>

          {feedback && (
            <span
              onClick={handleReattempt} className="bg-black text-white cursor-pointer py-2 px-5 rounded-full ml-2"
            >
              Reattempt question
            </span>
          )}
            <span onClick={getQuestion} className={`cursor-pointer py-2 px-5 rounded-lg ml-2 ${ isListening ? 'hidden' : 'bg-white border'}`}>
              { isListening ? '' : 'Next Question'} 
            </span>
          <div className="mt-2">{transcript}</div>
        </div>
        <div
          className={`transition-all ${ feedbackLoadingStatus || feedback ? 'w-1/2 border-left h-screen'  : 'w-100'
          }`}
        >
          {feedback && (
            <div className="mt-24">
              <p className="w-[100%] text-center">
                Let’s see how you answered:
              </p>
              <div className="max-h-48 overflow-auto border p-3 rounded-md">
                <p className="my-3 whitespace-pre-line">{feedback.feedback}</p>
              </div>
              <div className="border mt-3 p-3 rounded-lg">
                <p>Correctness:</p>
                <h1>{feedback.correctness}</h1>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 ${ i < Number(feedback.correctness) ? 'bg-blue-700' : 'bg-neutral-200'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
              <div className="border mt-3 p-3 rounded-lg">
                <p>Completeness: {feedback.completeness}</p>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 ${
                        i < Number(feedback.completeness)
                          ? 'bg-green-600'
                          : 'bg-neutral-200'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;