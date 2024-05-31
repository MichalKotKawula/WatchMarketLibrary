document.getElementById('loadData').addEventListener('click', async () => {
    const response = await fetch('http://localhost:3000/getWatchDetails');
    const data = await response.json();
    const watchDetails = document.getElementById('watchDetails');
  
    // Clear previous content
    watchDetails.innerHTML = '';
  
    // Display watch images
    const imagesContainer = document.createElement('div');
    data.WatchBasicDetails.image.forEach(img => {
      const imageElement = document.createElement('img');
      imageElement.src = img.contentUrl;
      imageElement.alt = 'Watch Image';
      imageElement.style.maxWidth = '200px';
      imageElement.style.marginRight = '10px';
      imagesContainer.appendChild(imageElement);
    });
    watchDetails.appendChild(imagesContainer);
  
    // Display basic details
    const basicDetails = data.WatchBasicDetails;
    const basicDetailsContainer = document.createElement('div');
    for (const key in basicDetails) {
      if (basicDetails.hasOwnProperty(key) && key !== 'image') {
        const detailElement = document.createElement('p');
        detailElement.textContent = `${key}: ${basicDetails[key]}`;
        basicDetailsContainer.appendChild(detailElement);
      }
    }
    watchDetails.appendChild(basicDetailsContainer);
  
    // Display more details (simplified for brevity)
    // You would iterate over WatchMoreDetails similarly to how we handled basic details
  
    // Display seller information
    const sellerInfo = data.SellerInfo;
    const sellerInfoContainer = document.createElement('div');
    for (const key in sellerInfo) {
      if (sellerInfo.hasOwnProperty(key)) {
        const infoElement = document.createElement('p');
        infoElement.textContent = `${key}: ${sellerInfo[key]}`;
        sellerInfoContainer.appendChild(infoElement);
      }
    }
    watchDetails.appendChild(sellerInfoContainer);
  });

  async function sendMessage() {
    const userInput = document.getElementById('userInput').value;
    if (!userInput.trim()) return;
  
    displayMessage(userInput, 'user');
  
    const aiResponse = await getAIResponse(userInput);
    displayMessage(aiResponse, 'ai');
  
    document.getElementById('userInput').value = '';
  }
  
  function displayMessage(message, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageElement = document.createElement('div');
    messageElement.className = sender === 'user' ? 'user-message' : 'ai-message';
    messageElement.innerText = message;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  async function getAIResponse(userInput) {
    const response = await fetch('http://localhost:3000/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userInput })
    });
  
    const data = await response.json();
    return data.response;
  }