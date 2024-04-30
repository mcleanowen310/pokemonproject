const express = require("express"); // Import the express module
const session = require("express-session"); // Import the express-session module
const app = express(); // Create an express application
const PORT = process.env.PORT || 3000;
const axios = require("axios");
const bodyParser = require("body-parser");

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// these lines setup an express-session
app.use(
  session({
    secret: "mypokemonsecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// code to set a user as a guest if they are not logged in
app.use((req, res, next) => {
  if (req.session.user) {
    res.locals.user = req.session.user;
  } else {
    res.locals.user = { role: "guest" }; // default to guest user if not logged in
  }
  next();
});

app.get("/", (req, res) => {
  res.render("home", { titletext: "Welcome to Pokémon Central" });
});

app.get("/login", (req, res) => {
  let message = req.session.message;
  req.session.message = null; // Clear the message after displaying it
  res.render("login", { titletext: "Log In", message: message });
});

app.post("/login", (req, res) => {
  axios
    .post("http://localhost:4000/login", req.body)
    .then((response) => {
      if (response.data.user) {
        // If authentication is successful
        req.session.user = {
          id: response.data.user.user_id, // Include the user id
          first_name: response.data.user.first_name,
          last_name: response.data.user.last_name,
        };
        res.redirect("/viewsets");
      } else {
        res.redirect("/login");
      }
    })
    .catch((error) => {
      res.redirect("/login");
    });
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false });
    }

    res.clearCookie("sid");
    return res.json({ success: true });
  });
});

app.get("/signup", (req, res) => {
  res.render("signup", { titletext: "Sign Up" });
});

app.post("/signup", (req, res) => {
  axios
    .post("http://localhost:4000/signup", req.body)
    .then((response) => {
      // If signup is successful, redirect to login page
      if (response.status === 200) {
        req.session.message = "User signup successful";
        res.redirect("/login");
      } else {
        // Handle any other response here
        res.render("signup", {
          titletext: "Sign Up",
          errorMessage: "Signup was not successful",
        });
      }
    })
    .catch((error) => {
      // Handle error
      console.error(error);
      let errorMessage = "Error signing up";
      if (
        error.response &&
        error.response.data.message === "Email already in use"
      ) {
        errorMessage =
          "Error signing up, please ensure the email used doesn't already have an account";
      } else if (
        error.response &&
        error.response.data.message === "Username already in use"
      ) {
        errorMessage =
          "Error signing up, please ensure the username used doesn't already have an account";
      }
      res.render("signup", {
        titletext: "Sign Up",
        errorMessage: errorMessage,
      });
    });
});

// route for viewing and changing user information
app.get("/userinfo", (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.redirect("/signup");
  }

  let user_id = req.session.user.id;
  let ep = `http://localhost:4000/user/${user_id}`;

  axios
    .get(ep)
    .then((response) => {
      let userData = response.data;

      res.render("userinfo", {
        titletext: "User Information",
        user: userData,
      });
    })
    .catch((error) => {
      console.error(error);
      res.redirect("/login");
    });
});

// allows a user to edit their information
app.get("/edituserinfo", (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.redirect("/signup");
  }

  let user_id = req.session.user.id;
  let ep = `http://localhost:4000/user/${user_id}`;

  axios
    .get(ep)
    .then((response) => {
      let userData = response.data;

      res.render("edituserinfo", {
        titletext: "Edit User Information",
        user: userData,
      });
    })
    .catch((error) => {
      console.error(error);
      res.redirect("/login");
    });
});

// route to handle the post request for editing user information
app.post("/edituserinfo", (req, res) => {
  let userId = req.session.user.id;
  let ep = `http://localhost:4000/user/${userId}`;

  axios
    .post(ep, req.body)
    .then((response) => {
      // If update is successful, redirect to user info page
      if (response.status === 200) {
        req.session.message = "User details updated successfully";
        res.redirect("/userinfo");
      } else {
        // Handle any other response here
        res.render("edituserinfo", {
          titletext: "Edit User Information",
          user: req.body,
          errorMessage: "Update was not successful",
        });
      }
    })
    .catch((error) => {
      // Handle error
      console.error(error);
      let errorMessage = "Error updating user details";
      res.render("edituserinfo", {
        titletext: "Edit User Information",
        user: req.body,
        errorMessage: errorMessage,
      });
    });
});

app.get("/viewsets", (req, res) => {
  //console.log(req.session.user); // Add this line
  let ep = "http://localhost:4000/sets";
  axios.get(ep).then((response) => {
    let setdata = response.data;

    // Pass the user's details to the view
    res.render("viewsets", {
      titletext: "Trading Card Sets",
      setdata,
      user: req.session.user, // Pass the user data to the view
    });
  });
});

app.get("/viewcards", (req, res) => {
  let ep = "http://localhost:4000/app";
  axios.get(ep).then((response) => {
    let pokedata = response.data;

    // Get the set_id from the query parameters
    let setId = req.query.set_id;

    // If a set_id was provided, filter the cards
    if (setId) {
      pokedata.data = pokedata.data.filter(
        (card) => card.set_id === Number(setId)
      );
    }

    // Sort the data alphabetically by pokemon name
    pokedata.data.sort((a, b) => a.name.localeCompare(b.name));

    res.render("viewcards", {
      titletext: "Trading Cards",
      pokedata,
      user: req.session.user, // Pass the user data to the view
      userRole: res.locals.user.role, // Pass the user role to the view
    });
  });
});

app.get("/singlecard", (req, res) => {
  let item_id = req.query.item;
  let endp = `http://localhost:4000/app/${item_id}`;

  axios.get(endp).then((response) => {
    let pokedatasingle = response.data;

    //used to test the data being sent when I clicked on each pokemon card
    //console.log(pokedatasingle);

    // Extract the data from the response
    let cardData = pokedatasingle.cardData[0];
    let abilitiesData = pokedatasingle.abilitiesData;
    let weaknessesData = pokedatasingle.weaknessesData;
    let attacksData = pokedatasingle.attacksData;
    let resistancesData = pokedatasingle.resistancesData;

    // Render the 'singlecard' view with the data
    res.render("singlecard", {
      titletext: cardData.name,
      cardData,
      abilitiesData,
      weaknessesData,
      attacksData,
      resistancesData,
      user: req.session.user, // Pass the user data to the view
    });
  });
});

app.get("/collectionlist", (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.redirect("/signup");
  }

  let user_id = req.session.user.id;
  //   console.log(`user_id: ${user_id}`);
  let ep = `http://localhost:4000/collection/${user_id}`;

  axios
    .get(ep)
    .then((response) => {
      let collectionData = response.data;

      res.render("collectionlist", {
        titletext: "My Collection",
        collectionData,
        user: req.session.user,
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error fetching collection" });
    });
});

app.get("/usercollections", (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.redirect("/signup");
  }

  let ep = `http://localhost:4000/user-collections`;

  axios
    .get(ep)
    .then((response) => {
      let userCollectionsData = response.data.data;

      res.render("usercollections", {
        titletext: "User Collections",
        userCollectionsData,
        user: req.session.user,
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error fetching user collections" });
    });
});

// A route to view a user's collection
app.get("/viewuserscollection/:user_id", (req, res) => {
  let userId = req.params.user_id;
  let ep = `http://localhost:4000/user-collections/${userId}`;
  let userEp = `http://localhost:4000/user/${userId}`; // endpoint to get user details

  axios
    .all([axios.get(ep), axios.get(userEp)])
    .then(
      axios.spread((collectionRes, userRes) => {
        let userCollectionData = collectionRes.data.data;
        // Ensure user_id is passed correctly
        userCollectionData = userCollectionData.map((collection) => ({
          ...collection,
          user_id: userId,
        }));
        let viewedUser = userRes.data; // get the viewed user's details
        res.render("viewuserscollection", {
          titletext: "User Collection",
          userCollectionData,
          user: req.session.user,
          viewedUserId: userId, // pass the viewed user's id to the EJS file
          viewedUser, // pass the viewed user's details to the EJS file
        });
      })
    )
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error fetching user's collection" });
    });
});

// A route to like a user's collection
app.post("/likecollection/:ownerUserId", (req, res) => {
  if (!req.session.user) {
    // If there's no user in the session, redirect to login page
    return res.redirect("/login");
  }

  let likerUserId = req.session.user.id;
  let ownerUserId = req.params.ownerUserId;
  let ep = `http://localhost:4000/likecollection/${ownerUserId}`;

  axios
    .post(ep, { liker_user_id: likerUserId, owner_user_id: ownerUserId })
    .then((response) => {
      res.redirect(`/viewuserscollection/${ownerUserId}`);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error liking collection" });
    });
});

// A route to rate a user's collection
app.post("/ratecollection/:user_id", (req, res) => {
  if (!req.session.user) {
    // If there's no user in the session, redirect to login page
    return res.redirect("/login");
  }

  let raterId = req.session.user.id;
  let rateeId = req.params.user_id;
  let ratingValue = req.body.ratingValue; // Changed from req.body.rating
  let ep = `http://localhost:4000/ratecollection`;

  axios
    .post(ep, { raterId, rateeId, ratingValue })
    .then((response) => {
      res.redirect(`/viewuserscollection/${rateeId}`);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error rating collection" });
    });
});

// A route to leave a comment on a user's collection
app.post("/leavecomment/:user_id", (req, res) => {
  if (!req.session.user) {
    // If there's no user in the session, redirect to login page
    return res.redirect("/login");
  }

  let commenterId = req.session.user.id;
  let commenteeId = req.params.user_id;
  let commentText = req.body.commentText;
  let ep = `http://localhost:4000/leavecomment`;

  axios
    .post(ep, { commenterId, commenteeId, commentText })
    .then((response) => {
      res.redirect(`/viewuserscollection/${commenteeId}`);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error posting comment" });
    });
});

const server = app.listen(PORT, () => {
  console.log(`Webpage started on port ${server.address().port}`);
});
