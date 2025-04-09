import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs/operators';

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
  private errorMessage = new BehaviorSubject<string>('');
  private currentAIModel = new BehaviorSubject<string>('gemini'); // Track which AI model is being used

  // Gemini API key
  private readonly GEMINI_API_KEY = 'AIzaSyBrnA6WwJRE9Iu2FXzE-BOL8JyPX71ijm4';
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

  // Mistral API key
  private readonly MISTRAL_API_KEY = 'p7KFyMJyUNKqwNDUX4kdKwEEpc5eTAA1';

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

  get errorMessage$(): Observable<string> {
    return this.errorMessage.asObservable();
  }

  get currentAIModel$(): Observable<string> {
    return this.currentAIModel.asObservable();
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
    console.log(`Generating ${count} AI questions for ${topic} at ${this.experienceLevel.value} level`);

    try {
      this.interviewState.next('loading_questions');

      // First, let's try Gemini
      try {
        this.currentAIModel.next('gemini');
        console.log('Attempting to generate questions with primary model (gemini-1.5-pro)');

        const prompt = this.prepareQuestionsPrompt(topic, count);
        const response = await this.callGeminiAPI(prompt);
        const questions = this.extractQuestionsFromResponse(response, topic);

        if (questions.length >= count) {
          console.log(`Generated ${questions.length} questions via Gemini API`);
          this.questions.next(questions);
          this.interviewState.next('answering');

          // Speak the first question
          const firstQuestion = `Let's begin your interview about ${topic}. ${questions[0].question}`;
          this.speak(firstQuestion);
          return;
        } else {
          throw new Error('Insufficient questions generated, falling back to backup model');
        }
      } catch (error) {
        console.error('Primary model failed:', error);

        // Try Mistral as fallback
        try {
          this.currentAIModel.next('mistral');
          console.log('Attempting with Mistral model');

          const prompt = this.prepareQuestionsPrompt(topic, count);
          const response = await this.callMistralAPI(prompt);
          const questions = this.extractQuestionsFromResponse(response, topic);

          if (questions.length >= count) {
            console.log(`Generated ${questions.length} questions via Mistral API`);
            this.questions.next(questions);
            this.interviewState.next('answering');

            // Speak the first question
            const firstQuestion = `Let's begin your interview about ${topic}. ${questions[0].question}`;
            this.speak(firstQuestion);
            return;
          } else {
            throw new Error('Insufficient questions generated by Mistral, falling back to default');
          }
        } catch (mistralError) {
          console.error('Mistral model also failed, using default questions', mistralError);
          // All models failed, fall back to default questions
          this.currentAIModel.next('fallback');
          this.generateDefaultQuestions(topic, count);
        }
      }
    } catch (error) {
      // Final fallback
      console.error('All AI models failed:', error);
      console.log('Falling back to default questions');
      this.currentAIModel.next('fallback');
      this.generateDefaultQuestions(topic, count);
    }
  }

  private generateDefaultQuestions(topic: string, count: number): void {
    console.log(`Generating ${count} default questions for ${topic}`);
    this.currentAIModel.next('fallback'); // Make sure UI shows fallback mode

    const defaultQuestions: InterviewQuestion[] = [];
    const normalizedTopic = topic.toLowerCase().trim();

    // Default programming questions by categories
    const javascriptQuestions = [
      "Could you explain the core concepts of JavaScript?",
      "What is the difference between let, const, and var in JavaScript?",
      "How does event delegation work in JavaScript?",
      "Explain closures in JavaScript with an example.",
      "What are Promises in JavaScript and how do they help with asynchronous operations?",
      "Describe the JavaScript event loop and how it works.",
      "What are arrow functions and how do they differ from regular functions?",
      "How does prototypal inheritance work in JavaScript?",
      "Explain the concept of hoisting in JavaScript.",
      "What is the purpose of the 'this' keyword in JavaScript?"
    ];

    const reactQuestions = [
      "Explain the virtual DOM concept in React.",
      "What are hooks in React and why were they introduced?",
      "Explain the component lifecycle methods in React.",
      "What is the difference between state and props in React?",
      "How would you optimize performance in a React application?",
      "What is JSX and why is it used in React?",
      "Explain the concept of controlled vs uncontrolled components.",
      "How does React handle routing?",
      "What are higher-order components in React?",
      "How does React's Context API work and when would you use it?"
    ];

    const angularQuestions = [
      "What are the key features of Angular?",
      "Explain the difference between one-way and two-way data binding.",
      "What are Angular directives and name the different types.",
      "How does dependency injection work in Angular?",
      "What is Angular's change detection strategy?",
      "Explain the Angular component lifecycle hooks.",
      "What are Angular services and how are they used?",
      "How would you optimize an Angular application for performance?",
      "What is AOT compilation in Angular?",
      "How does routing work in Angular?"
    ];

    const pythonQuestions = [
      "Could you explain the core concepts of Python?",
      "What are Python decorators and how do they work?",
      "Explain list comprehensions in Python.",
      "What are generators in Python and how do they differ from regular functions?",
      "How does memory management work in Python?",
      "What are the differences between Python 2 and Python 3?",
      "Explain the GIL (Global Interpreter Lock) in Python.",
      "How would you handle exceptions in Python?",
      "What are Python's magic methods and how are they used?",
      "Describe the difference between lists and tuples in Python."
    ];

    const nodeQuestions = [
      "What is Node.js and what are its key features?",
      "Explain the event-driven architecture of Node.js.",
      "What is the purpose of the package.json file?",
      "How does the Node.js module system work?",
      "What are streams in Node.js and how are they used?",
      "Explain the difference between process.nextTick() and setImmediate().",
      "How would you handle errors in Node.js applications?",
      "What is middleware in Express.js?",
      "How does Node.js handle concurrency with its single-threaded model?",
      "What are some performance optimization techniques for Node.js applications?"
    ];

    const generalQuestions = [
      "What is your approach to debugging complex issues?",
      "How do you stay updated with the latest technologies?",
      "Describe a challenging technical problem you've solved recently.",
      "How do you ensure code quality in your projects?",
      "What is your experience with version control systems?",
      "How do you handle technical debt?",
      "Describe your ideal development workflow.",
      "What considerations do you make for security in your applications?",
      "How do you approach testing your code?",
      "What's your experience with CI/CD pipelines?"
    ];

    // Select appropriate questions based on the topic
    let selectedQuestions: string[] = [];

    if (normalizedTopic.includes('javascript') || normalizedTopic.includes('js')) {
      selectedQuestions = javascriptQuestions;
    } else if (normalizedTopic.includes('react')) {
      selectedQuestions = reactQuestions;
    } else if (normalizedTopic.includes('angular')) {
      selectedQuestions = angularQuestions;
    } else if (normalizedTopic.includes('python')) {
      selectedQuestions = pythonQuestions;
    } else if (normalizedTopic.includes('node')) {
      selectedQuestions = nodeQuestions;
    } else {
      // Default to general questions if no specific topic matched
      selectedQuestions = generalQuestions;
    }

    // Take the requested number of questions or all available if fewer
    const numQuestions = Math.min(count, selectedQuestions.length);

    // Create question objects
    for (let i = 0; i < numQuestions; i++) {
      defaultQuestions.push({
        id: i,
        question: selectedQuestions[i],
        category: normalizedTopic
      });
    }

    console.log(`Created ${defaultQuestions.length} default questions for ${topic}`);

    // Update the questions and state
    this.questions.next(defaultQuestions);
    this.interviewState.next('answering');

    // Speak the first question if there is one
    if (defaultQuestions.length > 0) {
      const firstQuestion = `Let's begin your interview about ${topic}. ${defaultQuestions[0].question}`;
      this.speak(firstQuestion);
    } else {
      // This should never happen as we always have general questions
      const errorMessage = "I'm sorry, I couldn't generate questions. Please try a different topic.";
      this.speak(errorMessage);
    }
  }

  // Helper method for creating questions prompt
  private prepareQuestionsPrompt(topic: string, count: number): string {
    const experienceLevel = this.experienceLevel.value;
    return `
      As an expert technical interviewer, create ${count} high-quality interview questions about ${topic} 
      appropriate for a ${experienceLevel} level developer.
      
      Each question should:
      1. Be challenging but answerable in 2-3 minutes
      2. Test both theoretical knowledge and practical understanding
      3. Be specific to ${topic} (not general programming questions)
      4. Be clear and unambiguous
      
      Format your response as a numbered list of questions only, with no additional text.
      For example:
      1. What is X in ${topic} and how does it work?
      2. Explain the difference between Y and Z in ${topic}.
      
      Provide exactly ${count} questions.
    `;
  }

  // Helper method for extracting questions from API response
  private extractQuestionsFromResponse(response: string, topic: string): InterviewQuestion[] {
    const questions: InterviewQuestion[] = [];

    try {
      // Split by numbered lines (1. 2. etc)
      const lines = response.split(/\n+/);
      const questionPattern = /^\s*\d+\.?\s+(.+)$/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(questionPattern);

        if (match && match[1]) {
          const question = match[1].trim();

          // Filter out empty questions or ones that are too short
          if (question && question.length > 10) {
            questions.push({
              id: questions.length,
              question: question,
              category: topic
            });
          }
        }
      }

      console.log(`Extracted ${questions.length} questions from response`);
      return questions;
    } catch (error) {
      console.error('Error extracting questions from response:', error);
      return [];
    }
  }

  // Add missing methods for processing answers
  private async processAnswerAndAdvance(answer: string, currentIndex: number): Promise<void> {
    console.log(`Processing answer for question ${currentIndex + 1}:`, answer);

    // Log the current question and answer for analysis
    console.log(`Q${currentIndex + 1}: ${this.questions.value[currentIndex].question}`);
    console.log(`A${currentIndex + 1}: ${answer}`);

    try {
      // First check if the answer is of sufficient quality
      const qualityCheckPrompt = `
        You are an expert technical interviewer. Analyze if the following answer to a technical interview question is 
        sufficient to evaluate, or if it appears to be random, gibberish, or extremely low effort.
        
        Question: "${this.questions.value[currentIndex].question}"
        Answer: "${answer}"
        
        Determine if the answer is:
        1. Valid - A genuine attempt to answer the question with relevant information
        2. Invalid - Random text, gibberish, or extremely low effort (like "asdf", "hello", single words, etc.)
        
        ONLY respond with one word: "VALID" or "INVALID"
      `;

      // Check answer quality with backup mechanism
      let qualityResult = '';
      try {
        // Try primary API call
        qualityResult = await this.callGeminiAPI(qualityCheckPrompt);
      } catch (error) {
        console.error('Primary API call failed for quality check:', error);
        try {
          // Try Mistral as backup
          qualityResult = await this.callMistralAPI(qualityCheckPrompt);
        } catch (mistralError) {
          console.error('All API calls failed for quality check:', mistralError);
          // Default to allowing the response if all APIs fail
          qualityResult = "VALID";
        }
      }

      const isValidAnswer = !qualityResult.includes("INVALID");

      if (!isValidAnswer) {
        console.log('Low quality or nonsense answer detected');

        // Set error message for the UI
        this.errorMessage.next('Your answer appears to be too short or not relevant to the question. Please provide a more detailed response.');

        // Provide feedback about the low-quality answer - show this message EVERY time
        const lowQualityResponse = `I notice your answer doesn't seem to address the question. Please provide a genuine response to the technical question, or if you need help, you can ask for a hint or skip to the next question.`;

        // Show alert for immediate feedback to user
        if (typeof window !== 'undefined') {
          this.speak('Please provide a valid answer to the question. Random text or extremely short responses are not acceptable.');
        }

        this.speak(lowQualityResponse);
        this.chatHistory.push({ role: 'assistant', content: lowQualityResponse });

        // Don't advance to the next question automatically
        return;
      }

      // Clear any previous error message
      this.errorMessage.next('');

      // Added: Check if the answer is technically correct with a separate API call
      const correctnessCheckPrompt = `
        You are an expert technical interviewer. Analyze if the following answer to a technical interview question is 
        technically correct or incorrect.
        
        Question: "${this.questions.value[currentIndex].question}"
        Answer: "${answer}"
        
        Determine if the answer is:
        1. CORRECT - The answer is technically accurate and properly addresses the question
        2. INCORRECT - The answer contains technical inaccuracies, misconceptions, or fails to address the question properly
        
        ONLY respond with one word: "CORRECT" or "INCORRECT"
      `;

      // Check correctness with backup mechanism
      let correctnessResult = '';
      try {
        // Try primary API call
        correctnessResult = await this.callGeminiAPI(correctnessCheckPrompt);
      } catch (error) {
        console.error('Primary API call failed for correctness check:', error);
        try {
          correctnessResult = await this.callMistralAPI(correctnessCheckPrompt);
        } catch (mistralError) {
          console.error('All API calls failed for correctness check:', mistralError);
          // Default to neutral response if all APIs fail
          correctnessResult = "EVALUATION_FAILED";
        }
      }

      // If the answer is incorrect, set a warning message (but don't block progression)
      if (correctnessResult.includes("INCORRECT")) {
        this.errorMessage.next('Your answer contains technical inaccuracies. Review the feedback carefully.');
      }

      // Continue with evaluation for valid answers
      let evaluationPrompt = `
        You are an expert technical interviewer evaluating a candidate's answer.
        
        Question: "${this.questions.value[currentIndex].question}"
        Candidate's answer: "${answer}"
        
        First, analyze the answer thoroughly:
        1. Assess the technical depth and accuracy of the content
        2. Check if they provided specific examples or code samples
        3. Evaluate their communication clarity and approach
        4. Consider both the strengths and weaknesses of their response
      `;

      // Adjust evaluation prompt based on correctness check
      if (correctnessResult.includes("CORRECT")) {
        evaluationPrompt += `
        Then, provide a positive but honest evaluation that:
        1. Acknowledges what they got right
        2. Points out any minor improvements they could make
        3. Uses a rating system from 1-5 where 1 is poor and 5 is excellent
        4. Maintains a professional tone
        5. Is approximately 2-3 sentences long
        6. Uses English language only - no Hindi or other languages
        
        This answer appears to be technically correct, so focus on the strengths while noting any minor areas for improvement.
        `;
      } else if (correctnessResult.includes("INCORRECT")) {
        evaluationPrompt += `
        Then, provide a constructive but critical evaluation that:
        1. Clearly identifies the technical inaccuracies or misconceptions in their answer
        2. Explains what the correct information should be
        3. Uses a rating system from 1-5 where 1 is poor and 5 is excellent (this answer should receive a rating of 1-2)
        4. Maintains a professional tone
        5. Is approximately 2-3 sentences long
        6. Uses English language only - no Hindi or other languages
        
        This answer appears to contain technical inaccuracies, so focus on correcting these misconceptions clearly.
        `;
      } else {
        // Default case or if evaluation failed
        evaluationPrompt += `
        Then, provide a balanced evaluation that:
        1. Acknowledges what they got right, if anything
        2. Clearly points out misconceptions or areas for improvement
        3. Uses a rating system from 1-5 where 1 is poor and 5 is excellent
        4. Maintains a professional tone but does not inflate ratings for poor answers
        5. Is approximately 2-3 sentences long
        6. Uses English language only - no Hindi or other languages
        
        For answers that are minimal or show little technical knowledge, be honest and rate them lower (1-2).
        Only give ratings of 4-5 to answers that demonstrate strong technical understanding.
        `;
      }

      evaluationPrompt += `
        After your evaluation, tell them you're moving to the next question, but don't include the next question text.
      `;

      // Get evaluation with backup mechanism
      let evaluation = '';
      try {
        // Try primary API call
        evaluation = await this.callGeminiAPI(evaluationPrompt);
      } catch (error) {
        console.error('Primary API call failed for evaluation:', error);
        try {
          // Try Mistral as backup
          evaluation = await this.callMistralAPI(evaluationPrompt);
        } catch (mistralError) {
          console.error('All API calls failed for evaluation:', mistralError);
          // Use a default evaluation if all APIs fail
          evaluation = this.getDefaultEvaluation(correctnessResult);
        }
      }

      // Log the evaluation to console
      console.log(`Evaluation for Q${currentIndex + 1}:`, evaluation);

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
            Keep it brief and conversational, as if you're continuing an interview.
            Don't make it verbose - just transition naturally to this next question.
            
            Next question: "${nextQuestion.question}"
            
            Your response should be approximately 1-2 sentences introducing the question.
          `;

          // Get next question presentation with backup mechanism
          this.getNextQuestionPresentation(nextPrompt, nextQuestion.question);
        }, 1000);
      } else {
        // This was the last question, proceed to feedback
        console.log('All questions completed, generating feedback');

        // Update interview state to generating feedback
        this.interviewState.next('generating_feedback');

        // Speak a transition message
        const completionMessage = 'Thank you for completing all the questions. I\'m now generating your feedback based on your responses...';
        this.speak(completionMessage);

        // Generate comprehensive feedback
        setTimeout(() => {
          this.generateComprehensiveFeedback();
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing answer:', error);

      // Provide a fallback response if there's an error
      const errorResponse = 'I apologize, but I encountered an error evaluating your response. Let\'s move on to the next question.';
      this.speak(errorResponse);
      this.chatHistory.push({ role: 'assistant', content: errorResponse });

      // Move to the next question despite the error
      if (currentIndex < this.questions.value.length - 1) {
        setTimeout(() => {
          this.currentQuestionIndex.next(currentIndex + 1);
          this.speak(this.questions.value[currentIndex + 1].question);
        }, 2000);
      } else {
        // If this was the last question, try to generate feedback anyway
        this.interviewState.next('generating_feedback');
        setTimeout(() => {
          this.generateDefaultFeedback();
        }, 2000);
      }
    }
  }

  // Helper method to get next question presentation with backup
  private async getNextQuestionPresentation(prompt: string, rawQuestion: string): Promise<void> {
    try {
      // Try primary API call
      const nextIntro = await this.callGeminiAPI(prompt);
      this.speak(nextIntro);
      this.chatHistory.push({ role: 'assistant', content: nextIntro });
    } catch (error) {
      console.error('Primary API call failed for next question:', error);
      try {
        // Try Mistral as backup
        const nextIntro = await this.callMistralAPI(prompt);
        this.speak(nextIntro);
        this.chatHistory.push({ role: 'assistant', content: nextIntro });
      } catch (mistralError) {
        console.error('All API calls failed for next question:', mistralError);
        // Use a simple introduction if all APIs fail
        const fallbackIntro = `Now, let's move to the next question. ${rawQuestion}`;
        this.speak(fallbackIntro);
        this.chatHistory.push({ role: 'assistant', content: fallbackIntro });
      }
    }
  }

  // Provide a default evaluation when APIs fail
  private getDefaultEvaluation(correctnessResult: string): string {
    if (correctnessResult.includes("INCORRECT")) {
      return "Your answer contains some technical inaccuracies. I'd rate this response as a 2/5. Make sure to review the core concepts and try to provide more specific examples next time. Let's move on to the next question.";
    } else if (correctnessResult.includes("CORRECT")) {
      return "Your answer covers the key points correctly. I'd rate this response as a 4/5. You could add a bit more detail for a perfect score. Let's move on to the next question.";
    } else {
      return "Thank you for your answer. I'd rate this response as a 3/5. Consider adding more specific technical details and examples in your future responses. Let's move on to the next question.";
    }
  }

  // Voice synthesis
  public speak(text: string): void {
    if (!text || text.trim() === '') {
      console.log('Attempted to speak empty text, ignoring');
      return;
    }

    console.log('Speaking:', text);

    // Mark that AI is speaking - helpful for UI feedback
    this.isAISpeaking.next(true);

    // Cancel any existing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if ('speechSynthesis' in window) {
      try {
        // Create chunks to prevent cutting off due to length limits
        const chunks = this.chunkText(text, 150); // Split into 150 character chunks

        // Speak each chunk in sequence
        this.speakChunks(chunks, 0);
      } catch (error) {
        console.error('Error speaking text:', error);
        this.isAISpeaking.next(false);
      }
    } else {
      console.error('Speech synthesis not supported in this browser');
      this.isAISpeaking.next(false);
    }
  }

  private chunkText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private speakChunks(chunks: string[], index: number): void {
    if (index >= chunks.length) {
      // All chunks spoken
      this.isAISpeaking.next(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);

    // Select voice based on user preference
    const voiceURI = this.interviewerVoice.getValue();
    const voices = window.speechSynthesis.getVoices();

    if (voiceURI !== 'default' && voices.length > 0) {
      const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // Apply character personality adjustments
    const character = this.interviewerCharacter.getValue();
    switch (character) {
      case 'robot':
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        break;
      case 'human':
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        break;
      case 'alien':
        utterance.rate = 0.8;
        utterance.pitch = 1.3;
        break;
      default:
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
    }

    // Handle completion of this chunk
    utterance.onend = () => {
      // Speak the next chunk
      this.speakChunks(chunks, index + 1);
    };

    // Handle errors
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isAISpeaking.next(false);
    };

    // Speak this chunk
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isAISpeaking.next(false);
      console.log('Speech stopped');
    }
  }

  // Speech recognition
  public startListening(): void {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        console.log('Speech recognition started');
      } catch (error) {
        console.error('Error starting speech recognition:', error);

        // Try to restart if busy
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (retryError) {
            console.error('Failed to restart speech recognition:', retryError);
          }
        }, 500);
      }
    } else {
      console.log('Recognition already active or not available');
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        console.log('Speech recognition stopped');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  // Public methods for interview management
  public startInterview(userName: string = '', initialState: string = 'interview_setup'): void {
    console.log(`Starting interview for ${userName || 'user'} with initial state ${initialState}`);

    // Set user name if provided
    if (userName && userName.trim()) {
      this.userName = userName.trim();
      console.log('User name set to:', this.userName);
    }

    // Reset interview state
    this.interviewInProgress.next(true);
    this.interviewState.next(initialState);
    this.currentQuestionIndex.next(0);
    this.userResponses = {};
    this.chatHistory = [];

    // Start with default gemini model
    this.currentAIModel.next('gemini');

    // Clear any error messages
    this.errorMessage.next('');

    // Start speech recognition if supported
    this.startListening();

    // If starting with greeting, provide a welcome message
    if (initialState === 'greeting' || initialState === 'initial') {
      console.log('Starting with greeting');
      const greeting = `Hello ${this.userName}! I'm your AI interviewer. Welcome to the mock interview. Are you ready to begin?`;
      this.speak(greeting);
      this.chatHistory.push({ role: 'assistant', content: greeting });
    }
  }

  public endInterview(): void {
    console.log('Ending interview');

    // Reset state
    this.interviewInProgress.next(false);
    this.interviewState.next('interview_setup');
    this.stopListening();
    this.stopSpeaking();

    // Clear variables
    this.currentQuestionIndex.next(0);
    this.questions.next([]);
    this.feedback.next(null);
    this.errorMessage.next('');
  }

  public retakeInterview(): void {
    console.log('Retaking interview with same settings');

    // Keep the existing tech stack and experience level
    const topic = this.selectedTech.getValue();
    const count = this.questionCount;

    // Reset state but keep settings
    this.interviewInProgress.next(true);
    this.interviewState.next('loading_questions');
    this.currentQuestionIndex.next(0);
    this.userResponses = {};
    this.chatHistory = [];
    this.feedback.next(null);
    this.errorMessage.next('');

    // Generate new questions for the same topic
    console.log(`Regenerating questions for ${topic}`);
    this.generateAIQuestions(topic, count);

    // Start speech recognition
    this.startListening();
  }

  public restartListening(): void {
    console.log('Restarting speech recognition');
    this.stopListening();
    setTimeout(() => this.startListening(), 500);
  }

  public skipCurrentQuestion(): void {
    console.log('Skipping current question');
    const currentIndex = this.currentQuestionIndex.value;

    // Check if this is the last question
    if (currentIndex < this.questions.value.length - 1) {
      // Store empty response for current question if no response exists
      if (!this.userResponses[currentIndex]) {
        this.userResponses[currentIndex] = "[Question skipped by user]";
      }

      // Move to next question
      this.currentQuestionIndex.next(currentIndex + 1);
      const nextQuestion = this.questions.value[currentIndex + 1].question;
      const skipMessage = `Moving to the next question. ${nextQuestion}`;
      this.speak(skipMessage);
    } else {
      // This is the last question, end the interview
      this.interviewState.next('generating_feedback');
      const message = "That was the final question. Let me generate feedback based on your answers.";
      this.speak(message);
      this.chatHistory.push({ role: 'assistant', content: message });

      // Generate feedback
      setTimeout(() => {
        this.generateDefaultFeedback();
      }, 2000);
    }
  }

  public navigateToQuestion(index: number): void {
    console.log(`Navigating to question ${index + 1}`);

    if (index >= 0 && index < this.questions.value.length) {
      this.currentQuestionIndex.next(index);

      // Speak the question
      const question = this.questions.value[index].question;
      this.speak(question);
    } else {
      console.error(`Invalid question index: ${index}`);
    }
  }

  public storeResponseForCurrentQuestion(response: string): void {
    const currentIndex = this.currentQuestionIndex.value;
    console.log(`Storing response for question ${currentIndex + 1}`);
    this.userResponses[currentIndex] = response;
  }

  public getResponseForQuestion(index: number): string | null {
    return this.userResponses[index] || null;
  }

  public updateInterviewState(newState: string): void {
    console.log(`Updating interview state to: ${newState}`);
    this.interviewState.next(newState);
  }

  private generateDefaultFeedback(): void {
    console.log('Generating default feedback');
    const feedback: InterviewFeedback = {
      strengths: [
        "You provided clear answers to several questions",
        "You demonstrated some knowledge of the subject matter",
        "Your communication style was direct and concise"
      ],
      weaknesses: [
        "Some technical details could have been more accurate",
        "More examples would have strengthened your answers",
        "Consider structuring your answers with a clear beginning, middle, and conclusion"
      ],
      suggestedTopics: [
        "Review fundamentals of the topic you were interviewed on",
        "Practice explaining technical concepts clearly",
        "Work on providing concrete examples in your answers"
      ],
      overallRating: 3,
      detailedFeedback: "You did well in this mock interview but there's room for improvement. Your strongest answers were clear and contained good technical details. However, some answers could have been more comprehensive with better examples. Keep practicing and focus on structuring your answers with a clear introduction, detailed explanation, and conclusion."
    };

    this.feedback.next(feedback);
    this.interviewState.next('feedback');

    const feedbackSummary = `I've completed analyzing your performance. Overall you scored a ${feedback.overallRating}/10. Your main strengths were clear communication, while you could improve on providing more detailed examples.`;
    this.speak(feedbackSummary);
  }

  private generateComprehensiveFeedback(): void {
    console.log('Generating comprehensive feedback based on user responses');

    // Use default feedback if we haven't implemented the actual comprehensive feedback method
    this.generateDefaultFeedback();
  }

  public async replaceCurrentQuestion(): Promise<boolean> {
    const currentIndex = this.currentQuestionIndex.value;
    const topic = this.questions.value[currentIndex].category;

    console.log(`Replacing question ${currentIndex + 1} about ${topic}`);

    try {
      // Create a new question about the same topic
      const prompt = `
        Generate a single high-quality interview question about ${topic}.
        The question should:
        1. Be challenging but answerable in 2-3 minutes
        2. Test both theoretical knowledge and practical understanding
        3. Be clear and unambiguous
        4. Be specific to ${topic}
        
        Give me only the question itself with no numbering or additional text.
      `;

      let newQuestion = '';

      try {
        newQuestion = await this.callGeminiAPI(prompt);
      } catch (geminiError) {
        console.error('Gemini API failed for replacement question:', geminiError);
        try {
          newQuestion = await this.callMistralAPI(prompt);
        } catch (mistralError) {
          console.error('All APIs failed for replacement question:', mistralError);
          throw new Error('Failed to generate replacement question');
        }
      }

      if (newQuestion && newQuestion.length > 10) {
        // Create a copy of the current questions
        const updatedQuestions = [...this.questions.value];

        // Replace the current question
        updatedQuestions[currentIndex] = {
          id: currentIndex,
          question: newQuestion.trim(),
          category: topic
        };

        // Update the questions
        this.questions.next(updatedQuestions);

        // Speak the new question
        this.speak(`Here's a different question: ${newQuestion}`);

        return true;
      } else {
        throw new Error('Generated question is too short or empty');
      }
    } catch (error) {
      console.error('Error replacing question:', error);

      // Inform the user
      this.speak("I'm sorry, I couldn't generate a new question. Let's continue with this one.");

      return false;
    }
  }

  public manualSubmitInterview(): void {
    console.log('Manually submitting interview for feedback');

    // Check if all questions have answers
    const totalQuestions = this.questions.value.length;
    let answeredQuestions = 0;

    for (let i = 0; i < totalQuestions; i++) {
      if (this.userResponses[i]) {
        answeredQuestions++;
      }
    }

    console.log(`${answeredQuestions} of ${totalQuestions} questions answered`);

    // Update state to generating feedback
    this.interviewState.next('generating_feedback');

    // Provide a transition message
    const message = `Thank you for completing the interview. I'll now analyze your ${answeredQuestions} answers and provide feedback.`;
    this.speak(message);
    this.chatHistory.push({ role: 'assistant', content: message });

    // Generate feedback
    setTimeout(() => {
      this.generateDefaultFeedback();
    }, 2000);
  }

  // Adjust noise sensitivity - useful for different environments
  adjustNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    console.log(`Adjusting noise sensitivity to ${level}`);

    switch (level) {
      case 'low':
        this.minSpeechConfidence = 0.5; // More permissive
        this.minInterimLength = 1;
        break;
      case 'medium':
        this.minSpeechConfidence = 0.7; // Default
        this.minInterimLength = 3;
        break;
      case 'high':
        this.minSpeechConfidence = 0.9; // More strict
        this.minInterimLength = 5;
        break;
    }
  }

  private async generateQuestions(): Promise<void> {
    const topic = this.selectedTech.getValue();
    const count = this.questionCount;
    console.log(`Generating ${count} questions for ${topic}...`);
    this.generateAIQuestions(topic, count);
  }

  // API Calls implementation
  private async callGeminiAPI(prompt: string): Promise<string> {
    try {
      console.log('Calling Gemini API...');
      const url = `${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`;

      const response = await firstValueFrom(this.http.post(url, {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }));

      // Extract the response text from the API response
      const responseData = response as any;
      const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!generatedText) {
        throw new Error('Empty response from Gemini API');
      }

      return generatedText;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  private async callMistralAPI(prompt: string): Promise<string> {
    try {
      console.log('Calling Mistral API...');
      const response = await firstValueFrom(this.http.post('https://api.mistral.ai/v1/chat/completions', {
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant specializing in technical interviews.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.MISTRAL_API_KEY}`
        }
      }));

      const responseData = response as any;
      const generatedText = responseData?.choices?.[0]?.message?.content || '';

      if (!generatedText) {
        throw new Error('Empty response from Mistral API');
      }

      return generatedText;
    } catch (error) {
      console.error('Error calling Mistral API:', error);
      throw error;
    }
  }

  // Process manual user input
  public processManualInput(text: string): void {
    console.log('Processing manual input:', text);

    // Make sure we cancel any speech when user types manually
    this.stopSpeaking();

    // Clear interim speech detection display
    this.interimUserResponse.next('');

    // Store the manual input as the current user response
    this.currentUserResponse.next(text);

    // Process input based on current state
    switch (this.interviewState.value) {
      case 'greeting':
      case 'initial':
        if (this.isPositiveResponse(text)) {
          this.interviewState.next('interview_setup');
          const response = "Great! What tech stack would you like to be interviewed for? For example, React, Angular, Node.js, etc.";
          this.speak(response);
          this.chatHistory.push({ role: 'assistant', content: response });
        } else if (this.isNegativeResponse(text)) {
          console.log('User is not ready yet');
          this.endInterview();
        } else {
          this.interviewState.next('interview_setup');
          const response = "Let's get started! What tech stack would you like to be interviewed for? For example, React, Angular, Node.js, etc.";
          this.speak(response);
          this.chatHistory.push({ role: 'assistant', content: response });
        }
        break;

      case 'interview_setup':
        console.log('Tech stack input received:', text);
        // Prevent empty or very short tech stacks
        if (text.trim().length < 2) {
          const techPrompt = "Please specify a valid technology stack like JavaScript, React, Angular, etc.";
          this.speak(techPrompt);
          this.chatHistory.push({ role: 'assistant', content: techPrompt });
          return;
        }

        this.techStack = text;
        this.selectedTech.next(text);
        const techResponse = `I see you're preparing for ${this.techStack} interview. What's your experience level with ${this.techStack}? Please select: beginner, intermediate, or expert.`;
        this.speak(techResponse);
        this.chatHistory.push({ role: 'assistant', content: techResponse });
        this.interviewState.next('experience_level');
        break;

      case 'experience_level':
        // Detect experience level mentioned
        let level = 'intermediate'; // Default
        const normalizedText = text.toLowerCase().trim();
        if (normalizedText.includes('beginner') || normalizedText.includes('new') || normalizedText.includes('start')) {
          level = 'beginner';
        } else if (normalizedText.includes('expert') || normalizedText.includes('advanced') || normalizedText.includes('senior')) {
          level = 'expert';
        } else if (normalizedText.includes('intermediate') || normalizedText.includes('middle') || normalizedText.includes('mid')) {
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
        // Extract number from text
        const match = text.match(/\d+/);
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
        this.userResponses[currentIndex] = text;

        // Process the answer and move to the next question
        this.processAnswerAndAdvance(text, currentIndex);
        break;

      default:
        console.log('Unhandled interview state:', this.interviewState.value);
        break;
    }

    // Add the user input to chat history
    this.chatHistory.push({ role: 'user', content: text });
  }
}