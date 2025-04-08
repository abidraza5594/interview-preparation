import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';

export interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
}

export interface InterviewFeedback {
  strengths: string[];
  weaknesses: string[];
  suggestedTopics: string[];
  overallRating: number;
  detailedFeedback: string;
}

@Injectable({
  providedIn: 'root'
})
export class MockInterviewService {
  private recognition: any;
  private isListening = false;
  private interviewInProgress = new BehaviorSubject<boolean>(false);
  private interviewState = new BehaviorSubject<string>('interview_setup');
  private currentUserResponse = new BehaviorSubject<string>('');
  private interimUserResponse = new BehaviorSubject<string>('');
  private selectedTech = new BehaviorSubject<string>('');
  private questionCount = 3;
  private currentQuestionIndex = new BehaviorSubject<number>(0);
  private questions = new BehaviorSubject<InterviewQuestion[]>([]);
  private userResponses: { [key: number]: string } = {};
  private feedback = new BehaviorSubject<InterviewFeedback | null>(null);
  private userExperience = '';
  private userName = 'Candidate';
  private chatHistory: { role: string, content: string }[] = [];
  private techStack = '';
  private experienceLevel = new BehaviorSubject<string>('intermediate');

  // Gemini API key
  private readonly GEMINI_API_KEY = 'AIzaSyBrnA6WwJRE9Iu2FXzE-BOL8JyPX71ijm4';
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

  // Voice options for the interviewer
  private interviewerVoice = new BehaviorSubject<string>('default');
  private availableVoices = new BehaviorSubject<SpeechSynthesisVoice[]>([]);
  private interviewerCharacter = new BehaviorSubject<string>('robot');

  private isAISpeaking = new BehaviorSubject<boolean>(false);

  // Add noise detection thresholds
  private minSpeechConfidence = 0.7; // Only accept speech with at least 70% confidence
  private minInterimLength = 3; // Minimum length of interim text to be considered valid speech
  private lastConfidence = 0;
  private noiseDetectionTimer: any = null;
  private consecutiveNoiseCount = 0;
  private readonly MAX_NOISE_COUNT = 3; // Reset after this many consecutive noise detections

  // Add retry tracking for speech
  private speechRetryCount = 0;
  private maxSpeechRetries = 2;
  private lastSpeechText = '';

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.initSpeechRecognition();
    this.initVoices();
    
    // Set initial interview state
    this.interviewState.next('interview_setup');
  }

  get interviewInProgress$(): Observable<boolean> {
    return this.interviewInProgress.asObservable();
  }

  get interviewState$(): Observable<string> {
    return this.interviewState.asObservable();
  }

  get currentUserResponse$(): Observable<string> {
    return this.currentUserResponse.asObservable();
  }

  get interimUserResponse$(): Observable<string> {
    return this.interimUserResponse.asObservable();
  }

  get selectedTech$(): Observable<string> {
    return this.selectedTech.asObservable();
  }

  get questionCount$(): Observable<number> {
    // Return an Observable with the current questionCount value
    return new BehaviorSubject<number>(this.questionCount).asObservable();
  }

  get currentQuestionIndex$(): Observable<number> {
    return this.currentQuestionIndex.asObservable();
  }

  get questions$(): Observable<InterviewQuestion[]> {
    return this.questions.asObservable();
  }

  get feedback$(): Observable<InterviewFeedback | null> {
    return this.feedback.asObservable();
  }

  get interviewerVoice$(): Observable<string> {
    return this.interviewerVoice.asObservable();
  }

  get availableVoices$(): Observable<SpeechSynthesisVoice[]> {
    return this.availableVoices.asObservable();
  }

  get interviewerCharacter$(): Observable<string> {
    return this.interviewerCharacter.asObservable();
  }

  get isAISpeaking$(): Observable<boolean> {
    return this.isAISpeaking.asObservable();
  }

  get experienceLevel$(): Observable<string> {
    return this.experienceLevel.asObservable();
  }

  setInterviewerVoice(voiceURI: string): void {
    this.interviewerVoice.next(voiceURI);

    // Store the selected voice in local storage for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('preferredVoice', voiceURI);
    }

    // Reset the last speech text to force a voice preview
    this.lastSpeechText = '';
    
    // Add a small delay to ensure the voice change is processed before preview
    setTimeout(() => {
      // Automatically preview the selected voice
      this.previewVoice(`Hello! This is how I will sound during your interview.`);
    }, 300);
  }

  setCharacter(character: string): void {
    this.interviewerCharacter.next(character);
    
    // Reset the last speech text to force a character voice preview
    this.lastSpeechText = '';

    // Add a small delay to ensure the character change is processed
    setTimeout(() => {
      // Preview the selected character voice
      this.previewVoice(`Hello! I'm your ${character} interviewer today. How do I sound?`);
    }, 300);
  }

  previewVoice(text: string): void {
    // Call speak to generate speech with current voice settings
    this.speak(text);
  }

  private initVoices(): void {
    if ('speechSynthesis' in window) {
      // Get initial voices
      let voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        this.availableVoices.next(voices);
        // Load preferred voice from localStorage if available
        this.loadPreferredVoice();
      }

      // Voices might load asynchronously in some browsers
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        this.availableVoices.next(voices);
        if (voices.length > 0) {
          // Load preferred voice from localStorage if available
          this.loadPreferredVoice();
          // Trigger a voice preview with default voice to initialize the system
          setTimeout(() => {
            const testUtterance = new SpeechSynthesisUtterance('');
            testUtterance.volume = 0; // Silent
            window.speechSynthesis.speak(testUtterance);
          }, 500);
        }
      };

      // Initial test to ensure the speechSynthesis API is active
      setTimeout(() => {
        if (voices.length === 0) {
          // Try to trigger voices refresh manually
          const utterance = new SpeechSynthesisUtterance('');
          utterance.volume = 0;
          window.speechSynthesis.speak(utterance);

          // Check again after speaking
          setTimeout(() => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              this.availableVoices.next(voices);
              // Load preferred voice from localStorage if available
              this.loadPreferredVoice();
            } else {
              console.warn('Failed to load voices even after manual refresh');
            }
          }, 500);
        }
      }, 1000);
    } else {
      console.error('Speech synthesis not supported in this browser');
    }
  }

  // Load the preferred voice from localStorage
  private loadPreferredVoice(): void {
    if (typeof localStorage !== 'undefined') {
      const preferredVoice = localStorage.getItem('preferredVoice');
      if (preferredVoice) {
        console.log('Loading preferred voice from storage:', preferredVoice);
        this.interviewerVoice.next(preferredVoice);
      }
    }
  }

  private initSpeechRecognition(): void {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // Use the appropriate constructor with proper TypeScript typing
      const SpeechRecognitionAPI: any = (window as any)['webkitSpeechRecognition'] ||
        (window as any)['SpeechRecognition'];
      this.recognition = new SpeechRecognitionAPI();

      // Configure recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = 'en-US';

      // Set up handlers
      this.recognition.onstart = () => {
        console.log('Speech recognition started');
        this.isListening = true;
      };

      this.recognition.onend = () => {
        console.log('Speech recognition ended');
        this.isListening = false;

        // Auto-restart if interview is in progress and we're not deliberately stopping
        if (this.interviewInProgress.getValue() && this.isListening) {
          console.log('Auto-restarting speech recognition');
          setTimeout(() => this.startListening(), 500);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);

        // Error handling - try to restart on non-fatal errors
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.log('Attempting to recover from error by restarting');
          this.stopListening();
          setTimeout(() => this.startListening(), 1000);
        }
      };

      this.recognition.onresult = (event: any) => {
        this.processSpeechResults(event);
      };
    } else {
      console.error('Speech recognition not supported in this browser');
    }
  }

  private processSpeechResults(event: any): void {
    let interimTranscript = '';
    let finalTranscript = '';
    let highestConfidence = 0;

    // Process all results from the recognition event
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      const confidence = event.results[i][0].confidence;

      // Track highest confidence in this batch
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
      }

      if (event.results[i].isFinal) {
        // For final results, apply stricter confidence threshold
        if (confidence >= this.minSpeechConfidence) {
          finalTranscript += transcript;
          // Reset noise counter on successful speech detection
          this.consecutiveNoiseCount = 0;
        } else {
          console.log(`Rejected low confidence final result: ${transcript} (${confidence})`);
        }
      } else {
        interimTranscript += transcript;
      }
    }

    this.lastConfidence = highestConfidence;

    // For interim results, check length and pattern to filter out background noise
    if (interimTranscript) {
      // Check if interim transcript is just repeated characters or very short
      const isRepeatedPattern = /(.)\1{5,}/.test(interimTranscript) ||
        /(.{2,3})\1{3,}/.test(interimTranscript);

      if (interimTranscript.length < this.minInterimLength || isRepeatedPattern) {
        // Likely background noise
        this.consecutiveNoiseCount++;

        if (this.consecutiveNoiseCount >= this.MAX_NOISE_COUNT) {
          console.log('Multiple noise detections, clearing interim transcript');
          interimTranscript = '';
          this.interimUserResponse.next('');
          this.consecutiveNoiseCount = 0;
        } else {
          console.log(`Potential noise detected (${this.consecutiveNoiseCount}): "${interimTranscript}"`);
        }
      } else {
        // Valid speech detected - update display
        console.log('Valid interim transcript:', interimTranscript);
        this.interimUserResponse.next(interimTranscript);

        // Stop AI speech when user starts talking
        if (this.isAISpeaking.getValue()) {
          this.stopSpeaking();
        }

        // Reset noise counter
        this.consecutiveNoiseCount = 0;
      }
    }

    // Process final transcript when available
    if (finalTranscript) {
      console.log('Final transcript:', finalTranscript);

      // Clear the interim text briefly after we get a final result
      this.processUserSpeech(finalTranscript);
      setTimeout(() => this.interimUserResponse.next(''), 500);
    }
  }

  private processUserSpeech(transcript: string): void {
    console.log('Processing speech:', transcript, 'Current state:', this.interviewState.value);

    const normalizedTranscript = transcript.toLowerCase().trim();

    // Store the latest user message
    this.chatHistory.push({ role: 'user', content: transcript });

    switch (this.interviewState.value) {
      case 'greeting':
        if (normalizedTranscript.includes('yes') || normalizedTranscript.includes('ready') ||
          normalizedTranscript.includes('start') || normalizedTranscript.includes('let\'s go')) {
          this.interviewState.next('interview_setup');
          const response = "Great! What tech stack would you like to be interviewed for? For example, React, Angular, Node.js, etc.";
          this.speak(response);
          this.chatHistory.push({ role: 'assistant', content: response });
        } else if (normalizedTranscript.includes('no') || normalizedTranscript.includes('not yet') || normalizedTranscript.includes('wait')) {
          console.log('User is not ready yet, returning to initial state');
          this.endInterview();
          return;
        }
        break;

      case 'interview_setup':
        console.log('Tech stack input received:', normalizedTranscript);
        // Prevent empty or very short tech stacks
        if (transcript.trim().length < 2) {
          const techPrompt = "Please specify a valid technology stack like JavaScript, React, Angular, etc.";
          this.speak(techPrompt);
          this.chatHistory.push({ role: 'assistant', content: techPrompt });
          return;
        }
        
        this.techStack = transcript;
        this.selectedTech.next(transcript);
        const techResponse = `I see you're preparing for ${this.techStack} interview. What's your experience level with ${this.techStack}? Please select: beginner, intermediate, or expert.`;
        this.speak(techResponse);
        this.chatHistory.push({ role: 'assistant', content: techResponse });
        this.interviewState.next('experience_level');
        break;

      case 'experience_level':
        // Detect experience level mentioned
        let level = 'intermediate'; // Default
        if (normalizedTranscript.includes('beginner') || normalizedTranscript.includes('new') || normalizedTranscript.includes('start')) {
          level = 'beginner';
        } else if (normalizedTranscript.includes('expert') || normalizedTranscript.includes('advanced') || normalizedTranscript.includes('senior')) {
          level = 'expert';
        } else if (normalizedTranscript.includes('intermediate') || normalizedTranscript.includes('middle') || normalizedTranscript.includes('mid')) {
          level = 'intermediate';
        }
        
        this.experienceLevel.next(level);
        console.log(`Experience level set to: ${level}`);
        
        const expResponse = `I'll prepare questions suitable for a ${level} level in ${this.techStack}. How many questions would you like me to ask? Typically, I recommend 3-5 questions for a mock interview session.`;
        this.speak(expResponse);
        this.chatHistory.push({ role: 'assistant', content: expResponse });
        this.interviewState.next('question_count');
        break;

      case 'question_count':
        // Extract number from transcript
        const match = normalizedTranscript.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > 0 && num <= 10) {
            this.questionCount = num;
            console.log(`Setting question count to ${num}`);
            this.generateQuestions();
          } else {
            const countResponse = "Please select a number between 1 and 10 for the question count.";
            this.speak(countResponse);
            this.chatHistory.push({ role: 'assistant', content: countResponse });
          }
        } else {
          const invalidResponse = "I didn't catch a number there. Please specify how many questions you'd like, for example, '3 questions'.";
          this.speak(invalidResponse);
          this.chatHistory.push({ role: 'assistant', content: invalidResponse });
        }
        break;

      case 'answering':
        const currentIndex = this.currentQuestionIndex.value;
        const currQuestion = this.questions.value[currentIndex];
        console.log(`Processing answer for question ${currentIndex}:`, currQuestion.question);

        // Store user's response for the current question
        this.userResponses[currentIndex] = transcript;

        // Process the answer and move to the next question
        this.processAnswerAndAdvance(transcript, currentIndex);
        break;

      default:
        console.log('Unhandled interview state:', this.interviewState.value);
        break;
    }
  }

  private isPositiveResponse(response: string): boolean {
    // Added English positive responses with flexible matching
    const positiveKeywords = [
      'yes', 'yeah', 'sure', 'ok', 'okay', 'ready', 'let\'s go', 'begin', 'start',
      'yep', 'certainly', 'absolutely', 'of course', 'yes please', 'go ahead',
      'continue', 'proceed', 'willing', 'let\'s do it', 'i\'m ready'
    ];

    const lowerResponse = response.toLowerCase().trim();

    return positiveKeywords.some(keyword => {
      // For single-word keywords, try to match as whole words
      if (keyword.length <= 4) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(lowerResponse);
      }
      // For multi-word phrases, check for inclusion
      return lowerResponse.includes(keyword.toLowerCase());
    });
  }

  private isNegativeResponse(response: string): boolean {
    // Added English negative responses with flexible matching
    const negativeKeywords = [
      'no', 'nope', 'not yet', 'wait', 'not ready', 'stop', 'later',
      'hold on', 'give me a moment', 'give me a second', 'hang on', 'negative',
      'not now', 'let me think', 'i need time', 'not at the moment'
    ];

    const lowerResponse = response.toLowerCase().trim();

    return negativeKeywords.some(keyword => {
      // For single-word keywords, try to match as whole words
      if (keyword.length <= 4) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(lowerResponse);
      }
      // For multi-word phrases, check for inclusion
      return lowerResponse.includes(keyword.toLowerCase());
    });
  }

  private async generateHint(question: string): Promise<string> {
    try {
      const prompt = `
        You are an experienced technical interviewer. For the following interview question, provide a helpful hint or clue that will guide the candidate toward the correct answer without giving away the complete solution.
        
        Question: "${question}"
        
        The hint should:
        1. Point them in the right direction
        2. Be specific enough to be useful
        3. Not give the full answer
        4. Be 1-2 sentences maximum
        
        Provide only the hint, no other text.
      `;

      const response = await this.callGeminiAPI(prompt);
      return response.trim();
    } catch (error) {
      console.error('Error generating hint:', error);
      return "I'm having trouble providing a hint right now. Would you like to try answering or skip to the next question?";
    }
  }

  private async evaluateAnswer(question: string, answer: string): Promise<string> {
    try {
      const prompt = `
        You are an experienced technical interviewer. Evaluate the following candidate's answer to an interview question.
        
        Question: "${question}"
        Answer: "${answer}"
        
        Provide a brief, constructive evaluation that:
        1. Acknowledges what they got right
        2. Gently points out any misconceptions or areas that could be improved
        3. Provides a small piece of additional relevant information if appropriate
        4. Is encouraging and positive in tone
        5. Is 2-3 sentences maximum
        
        Provide only the evaluation, no other text.
      `;

      const response = await this.callGeminiAPI(prompt);
      return response.trim();
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return "Thank you for your answer. Let's continue with the interview.";
    }
  }

  private async analyzeTechStack(experience: string): Promise<string> {
    try {
      const prompt = `
        Based on the following technical background, determine the most suitable interview category (choose exactly one):
        - frontend
        - backend
        - fullstack
        - design
        
        Only respond with the single most appropriate category.
        
        Technical background: "${experience}"
      `;

      const response = await this.callGeminiAPI(prompt);
      const techStack = response.trim().toLowerCase();

      // Default to fullstack if we can't determine or get an unexpected response
      if (!['frontend', 'backend', 'fullstack', 'design'].includes(techStack)) {
        return 'fullstack';
      }

      return techStack;
    } catch (error) {
      console.error('Error analyzing tech stack:', error);
      return 'fullstack'; // Default to fullstack on error
    }
  }

  private async generateAIQuestions(topic: string, count: number): Promise<void> {
    try {
      // Log the request
      console.log(`Generating ${count} AI questions for ${topic} at ${this.experienceLevel.getValue()} level`);
      
      this.interviewState.next('loading_questions');
      
      // Store the tech stack
      this.techStack = topic;
      
      // Prepare the system prompt based on experience level
      const experienceLevel = this.experienceLevel.getValue();
      const difficultyLevel = experienceLevel === 'beginner' ? 'basic' : 
                             experienceLevel === 'intermediate' ? 'intermediate' : 'advanced';
      
      // System prompt for the AI to generate interview questions
      const systemPrompt = `Generate ${count} high-quality technical interview questions for a ${difficultyLevel} level ${topic} developer.
      
Format each question as a JSON object with these fields:
- "id": sequential number
- "question": detailed question text
- "category": relevant category of the question (e.g., "core concepts", "best practices", "performance", etc.)

The questions should:
- Be appropriate for a ${difficultyLevel} level developer
- Focus on practical, real-world scenarios
- Include a mix of conceptual and coding questions
- Be specifically tailored to ${topic}
- Challenge the candidate appropriately for their level
- Avoid overly theoretical or academic questions

For a beginner, focus on fundamental concepts and simple implementation questions.
For intermediate, include problem-solving and design questions.
For expert, include complex architectural decisions, performance optimization, and advanced concepts.

Return only valid JSON in this format:
[
  {"id": 1, "question": "...", "category": "..."},
  {"id": 2, "question": "...", "category": "..."},
  ...
]`;

      // User prompt specifying the request more directly
      const userPrompt = `Generate ${count} technical interview questions for a ${experienceLevel} ${topic} developer. Return only valid JSON.`;
      
      // Try generating questions with primary model
      let questionsGenerated = false;
      let errorMessage = '';
      
      try {
        console.log('Attempting to generate questions with primary model (gemini-1.5-pro)');
        
        const geminiUrl = `${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`;
        
        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt },
                { text: userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            topP: 0.95,
            topK: 40
          }
        };
        
        const response = await this.http.post<any>(geminiUrl, payload).toPromise();
        
        // Extract the generated text from the response
        const generatedText = response && response['candidates'] && 
                             response['candidates'][0] && 
                             response['candidates'][0]['content'] && 
                             response['candidates'][0]['content']['parts'] && 
                             response['candidates'][0]['content']['parts'][0]['text'] || '';
        
        console.log("AI Response:", generatedText);
        
        if (generatedText) {
          // Process the response to extract the questions
          try {
            // Find the JSON part in the response
            const jsonMatch = generatedText.match(/\[\s*\{.*\}\s*\]/s);
            const jsonStr = jsonMatch ? jsonMatch[0] : generatedText;
            
            // Clean up potential markdown code block formatting
            const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
            
            // Parse the JSON
            const parsedQuestions = JSON.parse(cleanJson);
            
            if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
              const formattedQuestions = parsedQuestions.map((q, index) => ({
                id: index + 1,
                question: q.question,
                category: q.category || 'general'
              }));
              
              // Store the generated questions
              this.questions.next(formattedQuestions);
              this.currentQuestionIndex.next(0);
              this.questionCount = formattedQuestions.length;
              
              // Set interview state to answering
              this.interviewState.next('answering');
              
              // Announce the first question
              const firstQuestion = formattedQuestions[0].question;
              setTimeout(() => {
                this.speak(`Let's begin your ${topic} interview. ${firstQuestion}`);
              }, 1000);
              
              // Log success
              console.log(`Successfully generated ${formattedQuestions.length} questions`);
              questionsGenerated = true;
              return;
            } else {
              errorMessage = "Failed to parse questions from primary model response";
              console.error(errorMessage, parsedQuestions);
            }
          } catch (parseError) {
            errorMessage = "Error parsing primary model AI response";
            console.error(errorMessage, parseError);
          }
        } else {
          errorMessage = "Empty response from primary model";
          console.error(errorMessage);
        }
      } catch (primaryError) {
        errorMessage = `Primary model error: ${(primaryError as any).status || 'Unknown'}`;
        console.error("Error with primary model:", primaryError);
        
        // Check if this is a rate limit error
        const isRateLimit = (primaryError as any).status === 429;
        if (isRateLimit) {
          console.log("Rate limit (429) detected, will try backup model");
        }
      }
      
      // If primary model failed, try backup model - gemini-pro
      if (!questionsGenerated) {
        try {
          console.log("Attempting with backup model (gemini-pro)");
          const backupUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";
          
          const backupPayload = {
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${systemPrompt}\n\n${userPrompt}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
              topP: 0.95,
              topK: 40
            }
          };
          
          const backupResponse = await this.http.post<any>(
            `${backupUrl}?key=${this.GEMINI_API_KEY}`, 
            backupPayload
          ).toPromise();
          
          const backupText = backupResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (backupText) {
            console.log("Backup model response:", backupText);
            
            try {
              // Find and extract JSON
              const jsonMatch = backupText.match(/\[\s*\{.*\}\s*\]/s);
              let parsedBackupQuestions;
              
              if (jsonMatch) {
                // Clean up JSON and parse it
                const cleanJson = jsonMatch[0].replace(/```json|```/g, '').trim();
                parsedBackupQuestions = JSON.parse(cleanJson);
              } else {
                // If no JSON was found, try to extract questions directly
                const questionLines = backupText
                  .split(/\n+/)
                  .filter((line: string) => line.includes("?") || /^\d+\.\s/.test(line))
                  .map((line: string, index: number) => line.replace(/^\d+\.\s+/, "").trim());
                
                if (questionLines.length > 0) {
                  // Convert to required format
                  parsedBackupQuestions = questionLines.map((q: string, i: number) => ({
                    id: i + 1, 
                    question: q, 
                    category: 'general'
                  }));
                } else {
                  throw new Error("Could not extract questions from backup model response");
                }
              }
              
              // Process the questions
              if (Array.isArray(parsedBackupQuestions) && parsedBackupQuestions.length > 0) {
                const formattedBackupQuestions = parsedBackupQuestions.map((q, index) => ({
                  id: index + 1,
                  question: q.question || q,
                  category: q.category || 'general'
                }));
                
                // Store the questions
                this.questions.next(formattedBackupQuestions);
                this.currentQuestionIndex.next(0);
                this.questionCount = formattedBackupQuestions.length;
                
                // Set interview state to answering
                this.interviewState.next('answering');
                
                // Announce the first question
                const firstQuestion = formattedBackupQuestions[0].question;
                setTimeout(() => {
                  this.speak(`Let's begin your ${topic} interview. ${firstQuestion}`);
                }, 1000);
                
                console.log(`Successfully generated ${formattedBackupQuestions.length} questions using backup model`);
                questionsGenerated = true;
                return;
              } else {
                throw new Error("Failed to parse valid questions from backup model");
              }
            } catch (backupParseError) {
              console.error("Error parsing backup model response:", backupParseError);
            }
          } else {
            console.error("Empty response from backup model");
          }
        } catch (backupError) {
          console.error("Backup model also failed:", backupError);
        }
      }
      
      // If we reach here, both models failed
      console.log(`Both AI models failed: ${errorMessage}. Falling back to default questions.`);
      this.generateDefaultQuestions(topic, count);
    } catch (error) {
      console.error("Error in generateAIQuestions:", error);
      this.generateDefaultQuestions(topic, count);
    }
  }

  private generateDefaultQuestions(topic: string, count: number): void {
    // Create specific questions about the selected topic
    const level = this.experienceLevel.value;
    
    // Tailor default questions based on the experience level
    let defaultQuestions: { id: number, question: string, category: string }[] = [];
    
    // JavaScript-specific questions if topic is JavaScript
    if (topic.toLowerCase() === 'javascript' || topic.toLowerCase() === 'js') {
      if (level === 'beginner') {
        defaultQuestions = [
          { id: 1, question: `What are the primitive data types in JavaScript?`, category: topic },
          { id: 2, question: `Explain the difference between let, const, and var in JavaScript.`, category: topic },
          { id: 3, question: `What is the difference between == and === operators in JavaScript?`, category: topic },
          { id: 4, question: `What is a callback function in JavaScript and how do you use it?`, category: topic },
          { id: 5, question: `How do you create an array in JavaScript and what are some common array methods?`, category: topic }
        ];
      } else if (level === 'intermediate') {
        defaultQuestions = [
          { id: 1, question: `Explain JavaScript closures with an example.`, category: topic },
          { id: 2, question: `What is the event loop in JavaScript and how does it work?`, category: topic },
          { id: 3, question: `Explain promises in JavaScript and how they differ from callbacks.`, category: topic },
          { id: 4, question: `What are the different ways to create objects in JavaScript?`, category: topic },
          { id: 5, question: `How does prototypal inheritance work in JavaScript?`, category: topic }
        ];
      } else { // expert
        defaultQuestions = [
          { id: 1, question: `Explain JavaScript module systems (CommonJS, AMD, ES modules) and their differences.`, category: topic },
          { id: 2, question: `How would you implement a deep copy function in JavaScript without using libraries?`, category: topic },
          { id: 3, question: `Explain the concept of microtasks and macrotasks in the JavaScript event loop.`, category: topic },
          { id: 4, question: `How would you optimize a JavaScript application for performance?`, category: topic },
          { id: 5, question: `Explain JavaScript proxies and their practical applications.`, category: topic }
        ];
      }
    } 
    // React-specific questions
    else if (topic.toLowerCase() === 'react') {
      if (level === 'beginner') {
        defaultQuestions = [
          { id: 1, question: `What is JSX in React?`, category: topic },
          { id: 2, question: `What is the difference between state and props in React?`, category: topic },
          { id: 3, question: `What are React components and what are the different types?`, category: topic },
          { id: 4, question: `How do you handle events in React?`, category: topic },
          { id: 5, question: `Explain the component lifecycle in React.`, category: topic }
        ];
      } else if (level === 'intermediate') {
        defaultQuestions = [
          { id: 1, question: `Explain the concept of React hooks and give examples of common hooks.`, category: topic },
          { id: 2, question: `How does React handle state management and what are some alternatives?`, category: topic },
          { id: 3, question: `What is the virtual DOM in React and how does it work?`, category: topic },
          { id: 4, question: `How would you optimize performance in a React application?`, category: topic },
          { id: 5, question: `Explain the concept of React context and when would you use it.`, category: topic }
        ];
      } else { // expert
        defaultQuestions = [
          { id: 1, question: `How would you implement a custom hook in React and what are some use cases?`, category: topic },
          { id: 2, question: `Explain the concept of React fiber architecture.`, category: topic },
          { id: 3, question: `How do you implement server-side rendering with React?`, category: topic },
          { id: 4, question: `What strategies would you use to test a complex React application?`, category: topic },
          { id: 5, question: `How would you integrate React with other libraries like D3.js?`, category: topic }
        ];
      }
    }
    // Generic tech questions if we don't have specific ones
    else {
      defaultQuestions = [
        { id: 1, question: `Could you explain the core concepts of ${topic}?`, category: topic },
        { id: 2, question: `What challenges have you faced when working with ${topic} and how did you overcome them?`, category: topic },
        { id: 3, question: `Explain the best practices when working with ${topic}.`, category: topic },
        { id: 4, question: `How does ${topic} compare to similar technologies or alternatives?`, category: topic },
        { id: 5, question: `What are the most common mistakes developers make with ${topic} and how to avoid them?`, category: topic },
        { id: 6, question: `How would you optimize performance when working with ${topic}?`, category: topic },
        { id: 7, question: `What are the latest developments or updates in ${topic}?`, category: topic },
        { id: 8, question: `How would you implement error handling in a ${topic} application?`, category: topic },
        { id: 9, question: `What security considerations are important when working with ${topic}?`, category: topic },
        { id: 10, question: `How do you test applications built with ${topic}?`, category: topic }
      ];
    }

    // Take only the number requested
    const selectedQuestions = defaultQuestions.slice(0, count);
    this.questions.next(selectedQuestions);

    // Start asking questions
    this.interviewState.next('answering');

    setTimeout(() => {
      const response = `Let's begin the interview about ${topic}. ${selectedQuestions[0].question}`;
      this.speak(response);
      this.chatHistory.push({ role: 'assistant', content: response });
    }, 1000);
  }

  private async generateFollowUpComment(question: string, answer: string): Promise<string> {
    try {
      const prompt = `
        As a technical interviewer, generate a brief, one-sentence transitional comment based on this interview exchange:
        
        Question: "${question}"
        Answer: "${answer}"
        
        The comment should:
        1. Acknowledge the candidate's response
        2. Be encouraging and professional
        3. Serve as a natural transition to the next question
        4. Be brief (maximum 15 words)
        
        Only provide the transitional comment, no other text.
      `;

      const response = await this.callGeminiAPI(prompt);
      return response.trim();
    } catch (error) {
      console.error('Error generating follow-up comment:', error);
      return "Thank you for that response. Moving to the next question.";
    }
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    try {
      console.log('Calling Gemini API with prompt:', prompt);

      // Create safe API URL - ensure we're using the correct model
      let apiUrl = this.GEMINI_API_URL;
      let modelUsed = 'gemini-1.5-pro';
      let useBackupModel = false;
      
      console.log('Attempting with primary model:', modelUsed);
      
      try {
        const payload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ]
        };

        const headers = {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.GEMINI_API_KEY
        };

        console.log('API URL:', apiUrl);
        console.log('Using API key:', this.GEMINI_API_KEY ? 'Exists' : 'Missing');

        const response = await firstValueFrom(this.http.post<any>(
          apiUrl,
          payload,
          { headers }
        ));

        console.log('Raw API response:', JSON.stringify(response, null, 2));

        if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.error('Empty response from Gemini API:', response);
          throw new Error('Invalid or empty response from Gemini API');
        }

        return response.candidates[0].content.parts[0].text;
      } catch (primaryError) {
        // Try backup model if primary fails
        console.error('Primary model failed:', primaryError);
        console.log('Trying backup model: gemini-pro');
        
        useBackupModel = true;
        modelUsed = 'gemini-pro';
        apiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
        
        const backupPayload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        };

        const headers = {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.GEMINI_API_KEY
        };

        console.log('Backup API URL:', apiUrl);
        
        const response = await firstValueFrom(this.http.post<any>(
          apiUrl,
          backupPayload,
          { headers }
        ));
        
        if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid or empty response from backup Gemini API');
        }
        
        return response.candidates[0].content.parts[0].text;
      }
    } catch (error: any) {
      console.error('All Gemini API attempts failed:', error?.message || error);
      
      // Return a generic response for API failures
      if (prompt.includes('greeting') || prompt.includes('meeting a candidate')) {
        return "Hello! I'm your AI interviewer. Are you ready to begin the interview?";
      } else if (prompt.includes('evaluate') || prompt.includes('feedback')) {
        return "Thank you for your answer. That's a good point, and I appreciate your explanation.";
      } else if (prompt.includes('questions') || prompt.includes('generate')) {
        return "I'll prepare some questions about the topic you mentioned.";
      } else {
        throw error; // Re-throw for other cases
      }
    }
  }


  startListening(): void {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);

        // Try to recover by re-initializing
        setTimeout(() => {
          this.initSpeechRecognition();
          this.recognition.start();
        }, 500);
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
    }
  }

  startInterview(userName: string, initialState: string = 'interview_setup'): void {
    // Don't restart if already in progress
    if (this.interviewInProgress.getValue()) {
      console.log('Interview already in progress, not restarting');
      return;
    }
    
    this.interviewInProgress.next(true);
    // Set to the provided initial state
    this.interviewState.next(initialState);
    this.currentQuestionIndex.next(0);
    this.userResponses = {};
    this.feedback.next(null);
    this.userExperience = '';
    this.userName = userName;

    // Reset chat history
    this.chatHistory = [];

    // Start speech recognition
    this.startListening();
  }

  endInterview(): void {
    // Stop listening first
    this.stopListening();

    // Set interview states
    this.interviewInProgress.next(false);
    this.interviewState.next('initial');

    // Clear chat history
    this.chatHistory = [];
  }

  retakeInterview(): void {
    // Save the user's name
    const userName = this.userName;

    // End current interview and start a new one
    this.stopListening();
    this.interviewInProgress.next(false);

    // Short delay before starting a new interview
    setTimeout(() => {
      this.startInterview(userName);
    }, 500);
  }

  private async generateComprehensiveAIFeedback(): Promise<void> {
    this.interviewState.next('generating_feedback');
    console.log('Starting feedback generation with timeout protection');
    
    // Log all questions and answers for comprehensive analysis
    console.log('Complete interview Q&A for feedback generation:');
    Object.keys(this.userResponses).forEach(index => {
      const i = parseInt(index);
      const question = this.questions.value[i]?.question || 'Unknown question';
      const answer = this.userResponses[i] || 'No response';
      console.log(`Q${i+1}: ${question}`);
      console.log(`A${i+1}: ${answer}`);
    });
    
    // Create a timeout controller
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Feedback generation timed out after 45 seconds');
      abortController.abort();
    }, 45000);

    try {
      // Use AbortController signal for proper timeout handling
      const feedbackPromise = new Promise<void>(async (resolve) => {
        try {
          console.log('Preparing feedback prompt...');
          // Prepare the prompt for feedback generation
          const prompt = this.prepareComprehensiveFeedbackPrompt();
          
          console.log('Calling API for feedback...');
          // First try to get valid feedback from the API
          try {
            // Attempt to get feedback from the main model
            const result = await this.callGeminiAPI(prompt);
            console.log('Received raw feedback response');
            
            // Extract any JSON-like structure from the response
            let feedback: InterviewFeedback | null = null;
            try {
              // Try to find JSON in the response
              const jsonMatch = result.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                try {
                  // Try to parse the JSON
                  const feedbackObj = JSON.parse(jsonStr);
                  console.log('Parsed feedback object:', feedbackObj);
                  
                  // Validate and format the feedback
                  const formattedFeedback = this.formatFeedbackObject(feedbackObj);
                  
                  // Log the complete feedback 
                  console.log('FINAL INTERVIEW FEEDBACK:', formattedFeedback);
                  console.log('--- STRENGTHS ---');
                  formattedFeedback.strengths.forEach(s => console.log(`- ${s}`));
                  console.log('--- WEAKNESSES ---');
                  formattedFeedback.weaknesses.forEach(w => console.log(`- ${w}`));
                  console.log('--- STUDY TOPICS ---');
                  formattedFeedback.suggestedTopics.forEach(t => console.log(`- ${t}`));
                  console.log(`--- RATING: ${formattedFeedback.overallRating}/10 ---`);
                  console.log('--- DETAILED FEEDBACK ---');
                  console.log(formattedFeedback.detailedFeedback);
                  
                  // Set the feedback in the BehaviorSubject
                  this.feedback.next(formattedFeedback);
                  this.interviewState.next('feedback');
                  
                  // Provide audio summary
                  const feedbackSummary = `I've analyzed your interview performance. Overall, your performance was rated ${formattedFeedback.overallRating} out of 10.`;
                  this.speak(feedbackSummary);
                  resolve();
                  return;
                } catch (jsonError) {
                  console.error('JSON parsing error:', jsonError);
                }
              }
              
              // If JSON parsing failed, try to extract structured data
              if (!feedback) {
                feedback = this.extractFeedbackFromText(result);
              }
              
              // If we got valid feedback, use it
              if (feedback) {
                console.log('Successfully extracted feedback');
                
                // Log the extracted feedback
                console.log('FINAL INTERVIEW FEEDBACK FROM TEXT EXTRACTION:');
                console.log('--- STRENGTHS ---');
                feedback.strengths.forEach(s => console.log(`- ${s}`));
                console.log('--- WEAKNESSES ---');
                feedback.weaknesses.forEach(w => console.log(`- ${w}`));
                console.log('--- STUDY TOPICS ---');
                feedback.suggestedTopics.forEach(t => console.log(`- ${t}`));
                console.log(`--- RATING: ${feedback.overallRating}/10 ---`);
                console.log('--- DETAILED FEEDBACK ---');
                console.log(feedback.detailedFeedback);
                
                this.feedback.next(feedback);
                this.interviewState.next('feedback');
                
                const feedbackSummary = `I've analyzed your interview performance. Overall, your performance was rated ${feedback.overallRating} out of 10.`;
                this.speak(feedbackSummary);
                resolve();
                return;
              }
            } catch (processingError) {
              console.error('Error processing API response:', processingError);
            }
          } catch (apiError) {
            console.error('API call failed:', apiError);
          }
          
          // If we get here, all extraction attempts failed - use fallback
          console.log('Using fallback feedback generation');
          const mockFeedback = this.generateEnglishMockFeedback();
          
          // Log the fallback feedback
          console.log('FALLBACK INTERVIEW FEEDBACK:');
          console.log('--- STRENGTHS ---');
          mockFeedback.strengths.forEach(s => console.log(`- ${s}`));
          console.log('--- WEAKNESSES ---');
          mockFeedback.weaknesses.forEach(w => console.log(`- ${w}`));
          console.log('--- STUDY TOPICS ---');
          mockFeedback.suggestedTopics.forEach(t => console.log(`- ${t}`));
          console.log(`--- RATING: ${mockFeedback.overallRating}/10 ---`);
          console.log('--- DETAILED FEEDBACK ---');
          console.log(mockFeedback.detailedFeedback);
          
          this.feedback.next(mockFeedback);
          this.interviewState.next('feedback');
          
          const fallbackMessage = `I've analyzed your interview. Your overall performance was rated ${mockFeedback.overallRating} out of 10.`;
          this.speak(fallbackMessage);
          resolve();
        } catch (error) {
          console.error('Error in feedback generation:', error);
          // Always ensure we provide some feedback
          const emergencyFeedback = this.generateEnglishMockFeedback();
          this.feedback.next(emergencyFeedback);
          this.interviewState.next('feedback');
          this.speak("I've prepared your interview feedback.");
          resolve();
        }
      });

      // Race between the feedback promise and the abort controller
      await Promise.race([
        feedbackPromise,
        new Promise<void>((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Feedback generation timeout'));
          });
        })
      ]);
      
      // Clear the timeout
      clearTimeout(timeoutId);
    } catch (error) {
      // This catches both timeout errors and other async errors
      console.error('Feedback generation failed:', error);
      
      // Always ensure we provide feedback even on timeout
      const fallbackFeedback = this.generateEnglishMockFeedback();
      this.feedback.next(fallbackFeedback);
      this.interviewState.next('feedback');
      this.speak("I've completed analyzing your interview responses.");
      
      // Clear the timeout
      clearTimeout(timeoutId);
    }
  }
  
  // Helper function to extract feedback from unstructured text
  private extractFeedbackFromText(text: string): InterviewFeedback | null {
    try {
      // Look for strengths
      const strengths: string[] = [];
      let strengthMatch = text.match(/strengths?:?\s*(.+?)(?=weaknesses|areas|improvements|rating|$)/is);
      if (strengthMatch && strengthMatch[1]) {
        // Extract bullet points or comma-separated items
        const strengthText = strengthMatch[1].trim();
        const strengthItems = strengthText.split(/(?:\r?\n|\r|•|,|\d+\.)+/).filter(s => s.trim().length > 0);
        strengths.push(...strengthItems.map(s => s.trim()).filter(s => s.length > 0).slice(0, 3));
      }
      
      // Look for weaknesses/areas to improve
      const weaknesses: string[] = [];
      let weaknessMatch = text.match(/(?:weaknesses|areas to improve|improvements):?\s*(.+?)(?=strengths|suggested|topics|rating|$)/is);
      if (weaknessMatch && weaknessMatch[1]) {
        const weaknessText = weaknessMatch[1].trim();
        const weaknessItems = weaknessText.split(/(?:\r?\n|\r|•|,|\d+\.)+/).filter(s => s.trim().length > 0);
        weaknesses.push(...weaknessItems.map(s => s.trim()).filter(s => s.length > 0).slice(0, 3));
      }
      
      // Look for suggested topics
      const suggestedTopics: string[] = [];
      let topicsMatch = text.match(/(?:suggested topics|topics to study|study):?\s*(.+?)(?=strengths|weaknesses|rating|detailed|$)/is);
      if (topicsMatch && topicsMatch[1]) {
        const topicsText = topicsMatch[1].trim();
        const topicItems = topicsText.split(/(?:\r?\n|\r|•|,|\d+\.)+/).filter(s => s.trim().length > 0);
        suggestedTopics.push(...topicItems.map(s => s.trim()).filter(s => s.length > 0).slice(0, 3));
      }
      
      // Look for rating
      let rating = 7; // Default rating
      const ratingMatch = text.match(/(?:rating|score|rated)[:. ]*(\d+)(?:[\s\/\\](\d+))?/i);
      if (ratingMatch) {
        const extractedRating = parseInt(ratingMatch[1]);
        const scale = ratingMatch[2] ? parseInt(ratingMatch[2]) : 10;
        
        // Normalize to scale of 10
        rating = Math.round((extractedRating / scale) * 10);
        
        // Ensure it's within bounds
        rating = Math.max(1, Math.min(10, rating));
      }
      
      // Extract detailed feedback - use the whole text if we can't find a specific section
      let detailedFeedback = text;
      const detailedMatch = text.match(/(?:detailed feedback|summary|overall):?\s*(.+?)(?=$)/is);
      if (detailedMatch && detailedMatch[1]) {
        detailedFeedback = detailedMatch[1].trim();
      }
      
      // If we couldn't extract strengths or weaknesses, the extraction failed
      if (strengths.length === 0 && weaknesses.length === 0) {
        return null;
      }
      
      // Ensure we have at least one item in each category
      if (strengths.length === 0) strengths.push(`Understanding of ${this.techStack} concepts`);
      if (weaknesses.length === 0) weaknesses.push(`Could provide more specific examples in ${this.techStack}`);
      if (suggestedTopics.length === 0) {
        suggestedTopics.push(`Advanced ${this.techStack} patterns`);
        suggestedTopics.push(`${this.techStack} performance optimization`);
      }
      
      return {
        strengths,
        weaknesses,
        suggestedTopics,
        overallRating: rating,
        detailedFeedback
      };
    } catch (error) {
      console.error('Error extracting feedback from text:', error);
      return null;
    }
  }
  
  // Helper function to format feedback object
  private formatFeedbackObject(obj: any): InterviewFeedback {
    // Create a default feedback structure
    const feedback: InterviewFeedback = {
      strengths: [],
      weaknesses: [],
      suggestedTopics: [],
      overallRating: 7,
      detailedFeedback: ''
    };
    
    // Try to map the object properties to our feedback structure
    if (obj.strengths && Array.isArray(obj.strengths)) {
      feedback.strengths = obj.strengths.slice(0, 3);
    } else if (obj.strengths && typeof obj.strengths === 'string') {
      feedback.strengths = [obj.strengths];
    }
    
    if (obj.weaknesses && Array.isArray(obj.weaknesses)) {
      feedback.weaknesses = obj.weaknesses.slice(0, 3);
    } else if (obj.weaknesses && typeof obj.weaknesses === 'string') {
      feedback.weaknesses = [obj.weaknesses];
    } else if (obj.areasToImprove && Array.isArray(obj.areasToImprove)) {
      feedback.weaknesses = obj.areasToImprove.slice(0, 3);
    }
    
    if (obj.suggestedTopics && Array.isArray(obj.suggestedTopics)) {
      feedback.suggestedTopics = obj.suggestedTopics.slice(0, 3);
    } else if (obj.topics && Array.isArray(obj.topics)) {
      feedback.suggestedTopics = obj.topics.slice(0, 3);
    }
    
    if (obj.rating && !isNaN(obj.rating)) {
      feedback.overallRating = Math.max(1, Math.min(10, obj.rating));
    } else if (obj.overallRating && !isNaN(obj.overallRating)) {
      feedback.overallRating = Math.max(1, Math.min(10, obj.overallRating));
    }
    
    if (obj.detailedFeedback && typeof obj.detailedFeedback === 'string') {
      feedback.detailedFeedback = obj.detailedFeedback;
    } else if (obj.feedback && typeof obj.feedback === 'string') {
      feedback.detailedFeedback = obj.feedback;
    } else if (obj.summary && typeof obj.summary === 'string') {
      feedback.detailedFeedback = obj.summary;
    }
    
    // Ensure we have at least one item in each category
    if (feedback.strengths.length === 0) {
      feedback.strengths.push(`Understanding of ${this.techStack} concepts`);
    }
    
    if (feedback.weaknesses.length === 0) {
      feedback.weaknesses.push(`Could provide more specific examples in ${this.techStack}`);
    }
    
    if (feedback.suggestedTopics.length === 0) {
      feedback.suggestedTopics.push(`Advanced ${this.techStack} patterns`);
      feedback.suggestedTopics.push(`${this.techStack} performance optimization`);
    }
    
    return feedback;
  }
  
  // Helper method to prepare the feedback prompt
  private prepareComprehensiveFeedbackPrompt(): string {
    // Collect all questions and answers
    const qaText = Object.keys(this.userResponses).map(index => {
      const i = parseInt(index);
      const q = this.questions.value[i]?.question || 'Unknown question';
      const a = this.userResponses[i] || 'No response';
      return `Question ${i+1}: ${q}\nAnswer: ${a}`;
    }).join('\n\n');
    
    return `You are an expert technical interviewer evaluating a candidate on ${this.techStack} at a ${this.experienceLevel.value} level.

Here are the questions and answers from the interview:

${qaText}

IMPORTANT: Carefully analyze each answer based on:
1. Technical accuracy and depth of knowledge
2. Completeness of the response
3. Use of examples or real-world applications
4. Communication clarity
5. Problem-solving approach

Please provide comprehensive feedback on the candidate's responses following this exact JSON format:
{
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Area to improve 1", "Area to improve 2", "Area to improve 3"],
  "suggestedTopics": ["Topic to study 1", "Topic to study 2", "Topic to study 3"],
  "overallRating": 7,
  "detailedFeedback": "Detailed paragraph of feedback summarizing the overall performance"
}

Your feedback MUST reflect the actual quality of the answers:
- If answers were brief or superficial, the rating should be lower (1-4)
- If answers demonstrated moderate knowledge, rating should be medium (5-7)
- Only if answers showed deep technical understanding should rating be high (8-10)

The strengths and weaknesses must directly reflect what you observed in their answers.
The suggested topics should be specific to ${this.techStack} and target their weak areas.
The detailed feedback should be constructive and actionable.
IMPORTANT: The response MUST be valid, parseable JSON with this exact structure.`;
  }

  // Fallback method for generating mock feedback in English
  private generateEnglishMockFeedback(): InterviewFeedback {
    return {
      strengths: [
        "Clear communication of technical concepts",
        "Structured approach to problem-solving"
      ],
      weaknesses: [
        "Could provide more specific examples",
        "Some technical knowledge gaps in advanced concepts"
      ],
      suggestedTopics: [
        `Advanced ${this.techStack} patterns`,
        `${this.techStack} performance optimization`,
        `Testing strategies for ${this.techStack}`,
        `Best practices in ${this.techStack} architecture`
      ],
      overallRating: 5,
      detailedFeedback: `You demonstrated understanding of ${this.techStack} fundamentals. Your explanations were generally clear, though you could strengthen your answers with more specific examples from your experience. Focus on deepening your knowledge of advanced concepts and performance optimization techniques to enhance your expertise.`
    };
  }

  processManualInput(text: string): void {
    console.log('Processing manual input:', text);
    // Manual input should bypass speech recognition checks
    this.isListening = false;

    // Force clear any interim speech to avoid confusion
    this.interimUserResponse.next('');

    // Check current state to handle tech stack selection
    const currentState = this.interviewState.value;
    console.log('Current state for manual input:', currentState);

    // Handle tech stack selection in interview_setup state
    if (currentState === 'interview_setup') {
      if (text.length >= 2 && text.length <= 30) {
        const techStack = text.trim();
        console.log('Setting tech stack to:', techStack);
        
        // Store the tech selection
        this.selectedTech.next(techStack);
        this.techStack = techStack;
        
        // Move to experience level selection
        this.interviewState.next('experience_level');
        return;
      }
    }
    // Handle experience level selection
    else if (currentState === 'experience_level') {
      const level = text.toLowerCase().trim();
      if (['beginner', 'intermediate', 'expert'].includes(level)) {
        console.log('Setting experience level to:', level);
        this.experienceLevel.next(level);
        
        // Move to question count selection
        this.interviewState.next('question_count');
        return;
      }
    }
    // Handle question count selection
    else if (currentState === 'question_count') {
      const count = parseInt(text);
      if (!isNaN(count) && count > 0 && count <= 50) {
        console.log('Setting question count to:', count);
        this.questionCount = count;
        
        // Generate questions
        this.generateQuestions();
        return;
      }
    }
    // Check if we're in greeting state and this is a tech stack entry
    else if (this.interviewState.value === 'greeting' || this.interviewState.value === 'initial') {
      const currentState = this.interviewState.value;
      console.log('Direct tech stack entry detected in', currentState, 'state');

      // If the user directly entered a tech stack in initial state
      if (text.length >= 2 && text.length <= 30) {
        // This could be a tech stack entry - set as tech stack and move to question count
        const techStack = text.trim();
        console.log('Setting tech stack directly to:', techStack);

        // If we were in initial state, start the interview first
        if (currentState === 'initial') {
          this.interviewInProgress.next(true);
          this.userName = 'User'; // Default name
        }

        // Set greeting as complete
        if (currentState === 'initial') {
          this.interviewState.next('greeting');
          // Add greeting to chat history
          const greeting = `Hello! I'm your AI interviewer. Welcome to the mock interview.`;
          this.chatHistory.push({ role: 'assistant', content: greeting });
        }

        // Set tech stack and move to experience level
        this.selectedTech.next(techStack.charAt(0).toUpperCase() + techStack.slice(1));
        this.techStack = techStack;

        const response = `Great! I'll be interviewing you about ${techStack}. What's your experience level with ${techStack}? Please select: beginner, intermediate, or expert.`;
        this.speak(response);
        this.chatHistory.push({ role: 'assistant', content: response });

        this.interviewState.next('experience_level');
        return;
      }
    }
    // Check if we're in the answering state - handle automatic question advancement
    else if (this.interviewState.value === 'answering' && text.trim().length > 0) {
      const currentIndex = this.currentQuestionIndex.value;
      const currentQuestion = this.questions.value[currentIndex];

      // Save the answer
      this.userResponses[currentIndex] = text;

      // Process the answer with immediate advancement
      this.processAnswerAndAdvance(text, currentIndex);
      return;
    }

    // Process the text through the normal flow for other states
    this.processUserSpeech(text);
  }

  // New method to process an answer and advance to the next question
  private async processAnswerAndAdvance(answer: string, currentIndex: number): Promise<void> {
    console.log(`Processing answer for question ${currentIndex + 1}:`, answer);
    
    // Log the current question and answer for analysis
    console.log(`Q${currentIndex + 1}: ${this.questions.value[currentIndex].question}`);
    console.log(`A${currentIndex + 1}: ${answer}`);

    try {
      const evaluationPrompt = `
        You are an expert technical interviewer evaluating a candidate's answer.
        
        Question: "${this.questions.value[currentIndex].question}"
        Candidate's answer: "${answer}"
        
        First, analyze the answer thoroughly:
        1. Assess the technical depth and accuracy of the content
        2. Check if they provided specific examples or code samples
        3. Evaluate their communication clarity and approach
        4. Consider both the strengths and weaknesses of their response
        
        Then, provide a brief, helpful evaluation that:
        1. Acknowledges what they got right
        2. Gently points out any misconceptions or areas for improvement
        3. Is encouraging and maintains a positive tone
        4. Is approximately 2-3 sentences long
        5. Uses English language only - no Hindi or other languages
        
        After your evaluation, tell them you're moving to the next question, but don't include the next question text.
      `;

      // Get evaluation
      const evaluation = await this.callGeminiAPI(evaluationPrompt);
      
      // Log the Gemini evaluation to console
      console.log(`Gemini evaluation for Q${currentIndex + 1}:`, evaluation);

      // Speak the evaluation
      this.speak(evaluation);
      this.chatHistory.push({ role: 'assistant', content: evaluation });

      // Check if this was the last question
      if (currentIndex < this.questions.value.length - 1) {
        // Move to next question after a short pause
        setTimeout(() => {
          // Update the current question index
          console.log(`Advancing from question ${currentIndex + 1} to ${currentIndex + 2}`);
          this.currentQuestionIndex.next(currentIndex + 1);

          // Get the next question
          const nextQuestion = this.questions.value[currentIndex + 1];

          // Generate natural presentation of the next question
          const nextPrompt = `
            You are a professional mock interviewer. Present the following question in a natural, conversational way.
            Don't say "Next question" or "Question X" - just present the question directly.
            Use English language only.
            
            Question: "${nextQuestion.question}"
          `;

          // Call API to get natural phrasing of the question
          this.callGeminiAPI(nextPrompt).then(response => {
            console.log('Speaking next question:', response);
            this.speak(response);
            this.chatHistory.push({ role: 'assistant', content: response });
          });
        }, 2000);
      } else {
        // This was the last question, move to feedback after a short pause
        setTimeout(() => {
          console.log('Last question answered, generating feedback');
          this.interviewState.next('generating_feedback');

          const response = `Great! You've answered all the questions. Now I'll analyze your responses and provide feedback.`;
          this.speak(response);
          this.chatHistory.push({ role: 'assistant', content: response });

          // Generate feedback
          setTimeout(() => {
            this.generateComprehensiveAIFeedback();
          }, 2000);
        }, 2000);
      }
    } catch (error) {
      console.error('Error evaluating answer:', error);

      // If evaluation fails, just move to the next question with a generic response
      const genericResponse = `Thank you for your answer. Let's continue with the interview.`;
      this.speak(genericResponse);
      this.chatHistory.push({ role: 'assistant', content: genericResponse });

      // Move to next question
      this.moveToNextQuestion(currentIndex);
    }
  }

  // New method to move to the next question
  private moveToNextQuestion(currentIndex: number): void {
    console.log(`Moving from question index ${currentIndex} to next question`);

    if (currentIndex < this.questions.value.length - 1) {
      setTimeout(() => {
        // Update current question index
        const newIndex = currentIndex + 1;
        console.log(`Setting question index to ${newIndex}`);
        this.currentQuestionIndex.next(newIndex);

        // Get the next question
        const nextQuestion = this.questions.value[newIndex];
        console.log('Next question:', nextQuestion.question);

        // Speak the question directly
        const response = `${nextQuestion.question}`;
        this.speak(response);
        this.chatHistory.push({ role: 'assistant', content: response });
      }, 1500);
    } else {
      // This was the last question
      console.log('That was the last question, moving to feedback');
      setTimeout(() => {
        this.interviewState.next('generating_feedback');

        const response = "That was the final question. I'll now analyze your answers and provide feedback.";
        this.speak(response);
        this.chatHistory.push({ role: 'assistant', content: response });

        setTimeout(() => {
          this.generateComprehensiveAIFeedback();
        }, 2000);
      }, 1500);
    }
  }

  restartListening(): void {
    console.log('Manually restarting speech recognition');

    // Force stop and clear any existing recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }

    // Add a small delay before starting again
    setTimeout(() => {
      this.isListening = true; // Set this flag to indicate we want to be listening
      this.startListening();
    }, 300);
  }

  // Add this method to detect when user hasn't responded
  private setupNoResponseTimeout(): void {
    console.log("Setting up no-response timeout");
    // Wait for 15 seconds to see if the user responds
    setTimeout(() => {
      const currentState = this.interviewState.value;

      // Only check if we're still in answering state
      if (currentState === 'answering') {
        const currentIndex = this.currentQuestionIndex.value;
        const currentQuestion = this.questions.value[currentIndex];

        // Check if there's been a response for this question
        if (!this.userResponses[currentIndex]) {
          console.log("No response detected after timeout");
          // No response detected, send a prompt
          this.callGeminiAPI(`
            You are a professional mock interviewer. The candidate hasn't responded to your question for 15 seconds.
            
            The current question is: "${currentQuestion.question}"
            
            Gently remind them that you're waiting for their response. Ask if they need you to repeat the question
            or if they'd like to skip it.
            
            Keep it brief and friendly.
          `).then(response => {
            this.speak(response);
            this.chatHistory.push({ role: 'assistant', content: response });

            // Repeat the question after the reminder
            setTimeout(() => {
              this.speak(currentQuestion.question);
            }, 2000);
          });
        }
      }
    }, 15000);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isAISpeaking.next(false);
    }
  }

  // Method to adjust noise sensitivity
  adjustNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    switch (level) {
      case 'low':
        this.minSpeechConfidence = 0.5;
        this.minInterimLength = 2;
        break;
      case 'medium':
        this.minSpeechConfidence = 0.7;
        this.minInterimLength = 3;
        break;
      case 'high':
        this.minSpeechConfidence = 0.8;
        this.minInterimLength = 5;
        break;
    }
    console.log(`Noise sensitivity set to ${level}: minConfidence=${this.minSpeechConfidence}, minLength=${this.minInterimLength}`);
  }

  // Handle skipping the current question
  skipCurrentQuestion(): void {
    const currentIndex = this.currentQuestionIndex.value;
    console.log('Service: Skipping question at index:', currentIndex);

    if (currentIndex < this.questions.value.length) {
      // Mark the question as skipped
      this.userResponses[currentIndex] = "Question skipped";

      // Instead of changing the index, we'll replace the current question with the next one
      // while keeping the same position
      const questions = [...this.questions.value];

      // If there are remaining questions, shift them up
      if (currentIndex < questions.length - 1) {
        // Get a copy of the questions
        const currentQuestion = questions[currentIndex];

        // Reorder the questions so the current question moves to the end
        // and all other questions shift up one position
        for (let i = currentIndex; i < questions.length - 1; i++) {
          questions[i] = questions[i + 1];
        }
        questions[questions.length - 1] = currentQuestion;

        // Update the questions list
        this.questions.next(questions);

        // Keep the same index but get the next question (which was shifted up)
        const nextQuestion = questions[currentIndex];
        console.log('Showing next question at same index:', nextQuestion.question);

        // Speak the next question
        const response = `Moving to the next question: ${nextQuestion.question}`;
        this.speak(response);
        this.chatHistory.push({ role: 'assistant', content: response });
      } else {
        // This was the last question, generate feedback
        console.log('Skipped last question, generating feedback');
        this.interviewState.next('generating_feedback');
        const response = `That was the final question. I'll now analyze your answers and provide feedback.`;
        this.speak(response);
        this.chatHistory.push({ role: 'assistant', content: response });

        // Generate feedback after a short delay
        setTimeout(() => {
          this.generateComprehensiveAIFeedback();
        }, 2000);
      }
    }
  }

  // Method to handle question generation
  private generateQuestions(): void {
    console.log(`Generating ${this.questionCount} questions for ${this.techStack} at ${this.experienceLevel.value} level`);
    
    // Set loading state first
    this.interviewState.next('loading_questions');
    
    // Clear any previous questions and responses
    this.questions.next([]);
    this.currentQuestionIndex.next(0);
    this.userResponses = {};
    
    // Generate questions after a short delay to allow UI state to update
    setTimeout(() => {
      this.generateAIQuestions(this.techStack, this.questionCount);
    }, 1000);
  }

  // Use the Web Speech API to speak text
  public speak(text: string): void {
    if ('speechSynthesis' in window) {
      // For voice previews, always allow speaking even if text is the same
      const isPreview = text.includes("how I will sound") || text.includes("How do I sound");
      
      // Only check for duplicate text if not a preview
      if (text === this.lastSpeechText && !isPreview) {
        console.log('Already tried to speak this text, skipping to prevent loops:', text);
        this.isAISpeaking.next(false);
        return;
      }
      
      // Always update the last text except for preview messages
      if (!isPreview) {
        this.lastSpeechText = text;
      }
      this.speechRetryCount = 0;
      
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      // Simplified text for speech synthesis if too long
      let speechText = text;
      if (text.length > 300) {
        // For very long text, create a simplified version
        speechText = `${text.substring(0, 100)}... I've analyzed your answers and provided feedback.`;
      }

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'en-US'; // Always use English
      utterance.rate = 0.95; // Slightly slower for better clarity
      utterance.pitch = 1.0;
      
      // Get all available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Get the selected voice URI
      const selectedVoiceURI = this.interviewerVoice.value;
      console.log('Using voice with URI:', selectedVoiceURI);
      
      if (voices && voices.length > 0) {
        // First try exact match by voiceURI
        let selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI);
        
        // If not found by URI, try by name
        if (!selectedVoice && selectedVoiceURI !== 'default') {
          selectedVoice = voices.find(voice => 
            voice.name === selectedVoiceURI ||
            voice.name.includes(selectedVoiceURI) ||
            (selectedVoiceURI && selectedVoiceURI.includes(voice.name))
          );
        }
        
        // If still not found, use any English voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith('en'));
        }
        
        if (selectedVoice) {
          console.log('Selected voice:', selectedVoice.name);
          utterance.voice = selectedVoice;
        } else {
          console.warn('No matching voice found for:', selectedVoiceURI);
        }
      }
      
      // Update speaking state
      this.isAISpeaking.next(true);

      // Add event handlers
      utterance.onstart = () => {
        this.isAISpeaking.next(true);
      };

      utterance.onend = () => {
        this.isAISpeaking.next(false);
      };

      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        this.isAISpeaking.next(false);
      };

      // Speak the text
      window.speechSynthesis.speak(utterance);
    } else {
      console.error('Speech synthesis not supported in this browser');
    }
  }

  // Completely disable speech chunking - it causes too many issues
  private speakChunks(chunks: string[], index: number): void {
    if (index >= chunks.length) {
      this.isAISpeaking.next(false);
      return;
    }
    
    // Only speak the first chunk and skip the rest to avoid loops
    if (index === 0) {
      const firstChunk = chunks[0];
      
      // Create a simplified version if text is too long
      let speechText = firstChunk;
      if (firstChunk.length > 150) {
        speechText = firstChunk.substring(0, 150) + "...";
      }
      
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      
      // Get selected voice
      const voices = window.speechSynthesis.getVoices();
      const selectedVoiceURI = this.interviewerVoice.value;
      
      if (selectedVoiceURI && selectedVoiceURI !== 'default') {
        const selectedVoice = voices.find(voice => 
          voice.voiceURI === selectedVoiceURI || 
          voice.name === selectedVoiceURI
        );
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      
      this.isAISpeaking.next(true);
      
      utterance.onend = () => {
        this.isAISpeaking.next(false);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech chunk error:', event);
        this.isAISpeaking.next(false);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  }

  // Save interview results to Firestore
  private saveInterviewResults(feedback: InterviewFeedback): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.uid) {
      const interviewData = {
        userId: currentUser.uid,
        userName: this.userName,
        timestamp: new Date(),
        technology: this.techStack,
        questionCount: this.questions.value.length,
        questions: this.questions.value.map(q => q.question),
        userResponses: this.userResponses,
        feedback: feedback,
        overallRating: feedback.overallRating,
        chatHistory: this.chatHistory
      };

      this.firestore.collection('interviews').add(interviewData)
        .then(() => console.log('Interview results saved'))
        .catch(error => console.error('Error saving interview results', error));
    } else {
      console.log('User not authenticated, interview results not saved');
    }
  }

  // Public method to update interview state
  updateInterviewState(newState: string): void {
    console.log(`Updating interview state from ${this.interviewState.getValue()} to ${newState}`);
    this.interviewState.next(newState);
  }
} 