import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBrnA6WwJRE9Iu2FXzE-BOL8JyPX71ijm4", // Use your actual API key
  authDomain: "interview-preparation-app.firebaseapp.com",
  projectId: "interview-preparation-app",
  storageBucket: "interview-preparation-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to check a user's admin status
async function checkUserAdminStatus(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      console.log('User data:', userData);
      console.log('Role:', userData.role);
      console.log('Is admin?', userData.role?.toLowerCase() === 'admin');
      return userData;
    } else {
      console.log('No such user!');
      return null;
    }
  } catch (error) {
    console.error('Error checking user:', error);
    return null;
  }
}

// Function to set a user as admin
async function setUserAsAdmin(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: 'admin'
    });
    console.log(`User ${userId} has been set as admin`);
    
    // Verify the change
    await checkUserAdminStatus(userId);
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

// Check and fix the specified user ID
const userId = 'YOUR_USER_ID'; // Replace with your actual user ID
checkUserAdminStatus(userId).then(userData => {
  if (userData && userData.role?.toLowerCase() !== 'admin') {
    // Ask for confirmation before changing
    console.log('User is not admin. Do you want to make them admin? (y/n)');
    // In a real environment, you would handle user input here
    // For simplicity in this demo, let's assume yes:
    // setUserAsAdmin(userId);
  }
}); 