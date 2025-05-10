let ingredients = [];
let SPOONACULAR_API_KEY = '';

// Load API key from .env file
async function loadEnvVariables() {
    try {
        const response = await fetch('mhm.env');
        const text = await response.text();
        
        const lines = text.split('\n');
        lines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key === 'SPOONACULAR_API_KEY') {
                    SPOONACULAR_API_KEY = value.trim();
                    console.log('API key loaded successfully');
                }
            }
        });
        
        if (!SPOONACULAR_API_KEY) {
            console.error('API key not found in env file');
        }
    } catch (error) {
        console.error('Error loading environment variables:', error);
    }
}

// Add ingredient to the list
function addIngredient() {
    const input = document.getElementById('ingredient-input');
    const ingredient = input.value.trim().toLowerCase();
    if (ingredient && !ingredients.includes(ingredient)) {
        ingredients.push(ingredient);
        displayIngredients();
    }
    input.value = '';
}

// Display all entered ingredients
function displayIngredients() {
    const ingredientsList = document.getElementById('ingredients-list');
    ingredientsList.innerHTML = '';
    ingredients.forEach((ingredient, index) => {
        const span = document.createElement('span');
        span.textContent = ingredient;
        span.title = "Click to remove";
        span.style.cursor = "pointer";
        span.onclick = () => removeIngredient(index);
        ingredientsList.appendChild(span);
    });
}

// Remove ingredient
function removeIngredient(index) {
    ingredients.splice(index, 1);
    displayIngredients();
}

// Find recipes with entered ingredients
async function findRecipes() {
    if (ingredients.length === 0) {
        alert('Please add some ingredients from your fridge!');
        return;
    }

    if (!SPOONACULAR_API_KEY) {
        try {
            await loadEnvVariables();
            if (!SPOONACULAR_API_KEY) {
                alert('API key not found. Please check your configuration.');
                return;
            }
        } catch (error) {
            console.error('Error loading API key:', error);
            alert('Could not load API key. Please check your configuration.');
            return;
        }
    }

    const query = ingredients.join(',');
    const apiUrl = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_API_KEY}&includeIngredients=${query}&number=10&addRecipeInformation=true&fillIngredients=true&ignorePantry=false`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();

        console.log('API Response:', data); // Debugging
        displayRecipes(data.results);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        alert('Could not fetch recipes. Please try again.');
    }
}

// Check if an ingredient name matches or is contained within another ingredient name
function ingredientMatches(userIngredient, recipeIngredient) {
    if (!userIngredient || !recipeIngredient) return false;
    
    const userIngLower = userIngredient.toLowerCase();
    const recipeIngLower = recipeIngredient.toLowerCase();
    
    // Check if it's an exact match or contains the ingredient
    return recipeIngLower === userIngLower || 
           recipeIngLower.includes(userIngLower) || 
           userIngLower.includes(recipeIngLower);
}

// Display recipes
function displayRecipes(matchingRecipes) {
    const recipesContainer = document.getElementById('recipes');
    recipesContainer.innerHTML = '';
    if (matchingRecipes.length > 0) {
        matchingRecipes.forEach(recipe => {
            const recipeCard = document.createElement('div');
            recipeCard.classList.add('recipe-card');

            // Process ingredients with improved matching
            let usedIngredientsArray = [];
            let missedIngredientsArray = [];
            
            // All ingredients in the recipe
            const allRecipeIngredients = [...(recipe.usedIngredients || []), ...(recipe.missedIngredients || [])];
            
            // Check each recipe ingredient against user ingredients
            allRecipeIngredients.forEach(recipeIng => {
                let found = false;
                
                // Check if this recipe ingredient matches any user ingredient
                for (const userIng of ingredients) {
                    if (ingredientMatches(userIng, recipeIng.name)) {
                        usedIngredientsArray.push(recipeIng.name);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    missedIngredientsArray.push(recipeIng.name);
                }
            });
            
            // Remove duplicates
            usedIngredientsArray = [...new Set(usedIngredientsArray)];
            missedIngredientsArray = [...new Set(missedIngredientsArray)];
            

            const usedIngredients = usedIngredientsArray.length > 0 ? usedIngredientsArray.join(', ') : 'None';
            const missedIngredients = missedIngredientsArray.length > 0 ? missedIngredientsArray.join(', ') : 'None';

            // Vegan/Vegetarian text
            let labels = '';

            if (recipe.vegan) {
                labels += '<span class="badge vegan"><i class="fas fa-leaf"></i> Vegan</span>';
            }

            if (recipe.vegetarian && !recipe.vegan) {
                labels += '<span class="badge vegetarian"><i class="fas fa-carrot"></i> Vegetarian</span>';
            }

            // Recipe card content
            recipeCard.innerHTML = `
                <img src="${recipe.image}" alt="${recipe.title}">
                <h3>${recipe.title}</h3>
                ${labels}
                <p style="color: #2f302f;"><strong>Ingredients You Have:</strong> ${usedIngredients}</p>
                <p style="color: #787a79;"><strong>Ingredients You Need:</strong> ${missedIngredients}</p>
            `;

            recipeCard.onclick = () => showRecipeDetails(recipe, usedIngredientsArray, missedIngredientsArray);
            recipesContainer.appendChild(recipeCard);
        });
    } else {
        recipesContainer.innerHTML = '<p>No recipes found. Try adding more ingredients!</p>';
    }
}

// Modal showing recipe details 
async function showRecipeDetails(recipe, usedIngredientsArray, missedIngredientsArray) {
    if (!SPOONACULAR_API_KEY) {
        try {
            await loadEnvVariables();
            if (!SPOONACULAR_API_KEY) {
                alert('API key not found. Please check your configuration.');
                return;
            }
        } catch (error) {
            console.error('Error loading API key:', error);
            alert('Could not load API key. Please check your configuration.');
            return;
        }
    }

    const apiUrl = `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`;
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch recipe details.');

        const detailedRecipe = await response.json();

        const sanitizeHTML = (html) => {
            if (!html) return 'No instructions available.';
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return doc.body.textContent || 'No instructions available.';
        };

        const instructions = sanitizeHTML(detailedRecipe.instructions);
        const usedIngredients = usedIngredientsArray.join(', ') || 'None';
        const missedIngredients = missedIngredientsArray.join(', ') || 'None';

        document.getElementById('modal-title').textContent = detailedRecipe.title;
        document.getElementById('modal-image').src = detailedRecipe.image;
        document.getElementById('modal-description').textContent = instructions; 

        document.getElementById('modal-ingredients-having').textContent = `${usedIngredients}`;
        document.getElementById('modal-ingredients-needing').textContent = `${missedIngredients}`;
        
        const modal = document.getElementById('recipe-modal');
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching detailed recipe:', error);
        alert('Failed to load recipe details.');
    }
}

// Close recipe modal
function closeRecipeModal() {
    document.getElementById('recipe-modal').style.display = 'none';
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
    // Load the API key first before other operations
    await loadEnvVariables();
    
    // Close modal on X click
    document.getElementById('close-modal').onclick = closeRecipeModal;
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('recipe-modal');
        if (event.target === modal) {
            closeRecipeModal();
        }
    };
    
    // Welcome modal on first visit
    const welcomeModal = document.getElementById('welcome-modal');
    const modalOverlay = document.querySelector('.modal-overlay');
    
    if (welcomeModal && modalOverlay && !sessionStorage.getItem("modalShown")) {
        welcomeModal.style.display = "block";
        modalOverlay.style.display = "block";
        sessionStorage.setItem("modalShown", "true");
        
        // Close welcome modal
        const closeButtons = welcomeModal.querySelectorAll('.close, #welcome-modal-close');
        closeButtons.forEach(button => {
            button.addEventListener("click", () => {
                welcomeModal.style.display = "none";
                modalOverlay.style.display = "none";
            });
        });
        
        // Close modal on overlay click
        modalOverlay.addEventListener("click", () => {
            welcomeModal.style.display = "none";
            modalOverlay.style.display = "none";
        });
    }
    
    // Enter key for ingredient input
    const ingredientInput = document.getElementById('ingredient-input');
    ingredientInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addIngredient();
        }
    });
});