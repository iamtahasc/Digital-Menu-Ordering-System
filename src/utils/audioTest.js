// Utility function to test audio playback
export const testAudioPlayback = (audioPath) => {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(audioPath);
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log(`Audio ${audioPath} played successfully`);
          resolve(true);
        }).catch(error => {
          console.warn(`Audio ${audioPath} play failed:`, error);
          reject(error);
        });
      } else {
        // Older browsers might not return a promise
        audio.addEventListener('play', () => {
          console.log(`Audio ${audioPath} played successfully`);
          resolve(true);
        });
        
        audio.addEventListener('error', (error) => {
          console.warn(`Audio ${audioPath} play failed:`, error);
          reject(error);
        });
      }
    } catch (error) {
      console.warn(`Error creating audio ${audioPath}:`, error);
      reject(error);
    }
  });
};

// Test both audio files
export const testAllAudio = async () => {
  try {
    await testAudioPlayback('/customer.mp3');
    console.log('Customer audio test passed');
  } catch (error) {
    console.warn('Customer audio test failed:', error);
  }
  
  try {
    await testAudioPlayback('/staff.mp3');
    console.log('Staff audio test passed');
  } catch (error) {
    console.warn('Staff audio test failed:', error);
  }
};