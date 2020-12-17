$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navLinks = $(".main-nav-links");
  const $userProfile = $("#user-profile");
  const $navUserProfile = $("#nav-user-profile");
  const $navWelcome = $("#nav-welcome");
  const $favoritedStories = $("#favorited-articles");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("#nav-all").on("click", async function() {
    hideElements();
    location.reload();
    await generateStories();
    $allStoriesList.show();
  });

  // event click to show submit form
  $("#nav-submit").on("click", function() {
    hideElements();
    $submitForm.show();
    $userProfile.hide();
  });

  // event click to user profile
  $navUserProfile.on("click", function() {
    hideElements();
    $userProfile.show();
  })

  // event click to show fav stories
  $("#nav-favorites").on("click", function() {
    hideElements();
    generateFaves();
    $favoritedStories.show();
  })

  // event click to show stories user has posted
  $("#nav-my-stories").on("click", function() {
    hideElements();
    $userProfile.hide();
    generateMyStories();
    $ownStories.show();
  })

  // event click for favoriting story
  $(".star").on("click", function(e) {
    const $target = $(e.target);
    const $closestLi = $target.closest("li");
    const storyId = $closestLi.attr("id");

    if ($target.hasClass("fas")) {
      currentUser.removeFavorite(storyId);
      $target.closest("i").toggleClass("fas far");
    } else {
      currentUser.addFavorite(storyId);
      $target.closest("i").toggleClass("fas far");
    }
  })

  // event click for deleting story
  $ownStories.on("click", ".trash-can", async function(e) {
    const $closestLi = $(e.target).closest("li");
    const storyId = $closestLi.attr("id");
    console.log(e)

    await storyList.removeStory(currentUser, storyId);
    await generateStories();
    hideElements();
    $allStoriesList.show();
  });


  // event submit to submit user story
  $submitForm.on("submit", async function(e) {
    e.preventDefault();
    const author = $('#author').val();
    const title = $('#title').val();
    const url = $('#url').val();
    const hostName = getHostName(url);
    const username = currentUser.username;
    const storyObject = await storyList.addStory(currentUser, {
      title,
      author,
      url,
      username
    });

    // html mark up for created story
    const $li = $(`
      <li id="${storyObject.storyId}" class="id-${storyObject.storyId}">
        <span class="star">
          <i class="far fa-star"></i>
        </span>
        <a class="article-link" href="${url}" target="a_blank">
          <strong>${title}</strong>
        </a>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-author">by ${author}</small>
        <small class="article-username">posted by ${username}</small>
      </li>`
      );
      $allStoriesList.prepend($li);

      $submitForm.slideUp("slow");
      $submitForm.trigger("reset");
      await generateStories();
      $allStoriesList.show();
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
      generateProfile();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    generateProfile();
  }

  function generateProfile() {
    $("#profile-name").text(`Name: ${currentUser.name}`);
    $("#profile-username").text(`Username: ${currentUser.username}`);
    $("#profile-account-date").text(`Account Created: ${currentUser.createdAt.slice(0, 10)}`);
    
    $navUserProfile.text(`${currentUser.username}`);
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, ownStory) {
    let hostName = getHostName(story.url);
    let starType = isFavorite(story) ? "fas" : "far";
    
    const trashCan = ownStory ? 
      `<span class="trash-can">
        <i class="fas fa-trash-alt"></i>
       </span>` : "";
   
    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${trashCan}
        <span class="star">
          <i class="${starType} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }


  function isFavorite(story) {
    let favStoryIds = new Set();
    if (currentUser) {
      favStoryIds = new Set(currentUser.favorites.map(obj => obj.storyId));
    }
    return favStoryIds.has(story.storyId);
  }

  // generate fav stories
  function generateFaves() {
    $favoritedStories.empty();

    if (currentUser.favorites.length === 0) {
      $favoritedStories.append("<h5>No favorites!</h5>");
    } else {
      for (let story of currentUser.favorites) {
        let favoriteHTML = generateStoryHTML(story, false, true);
        $favoritedStories.append(favoriteHTML);
      }
    }
  }

  // generate stories created by user
  function generateMyStories() {
    $ownStories.empty();

    if (currentUser.ownStories.length === 0) {
      $ownStories.append("<h5>No stories added yet!</h5>");
    } else {
      for (let story of currentUser.ownStories) {
        let ownStoryHTML = generateStoryHTML(story, true);
        $ownStories.append(ownStoryHTML);
      }
    }

    $ownStories.show();
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $userProfile,
      $loginForm,
      $createAccountForm,
      $userProfile,
      $favoritedStories
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLinks.toggleClass("hidden");
    $userProfile.hide();
    $navWelcome.show();
    $navLogOut.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
