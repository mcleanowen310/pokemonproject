// configure your Express server, set up environment variables using dotenv,
// and import necessary modules for handling web requests and database connections.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const mysql = require("mysql2");
const expressSession = require("express-session");
const cookieParser = require("cookie-parser");

const PORT = process.env.PORT || 4000;
app.set("view engine", "ejs");

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(cors());
app.use(
  expressSession({
    secret: "your-secret-key",
    saveUninitialized: false,
    resave: false,
  })
);

// sets up the database connection
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 10,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

// get database connection
connection.getConnection((err) => {
  if (err) return console.log(err.message);
  console.log("connected to local mysql db using .env properties");
});

// This returns all the sets of pokemon cards that we have in the card_set table of our database
app.get("/sets", (req, res) => {
  let allSets = `SELECT * FROM card_set`;
  connection.query(allSets, (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This returns all the pokemon cards that we have in the card table of our database
app.get("/app", (req, res) => {
  let allPokemon = `SELECT card.*, card_set.name as set_name FROM card JOIN card_set ON card.set_id = card_set.set_id`;
  connection.query(allPokemon, (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This selects a single card from the card table based on the card_id that is searched
app.get("/app/:rowid", (req, res) => {
  let r_id = req.params.rowid;
  let getcard = `SELECT * FROM card WHERE card_id=${r_id}`;
  connection.query(getcard, (err, cardData) => {
    if (err) throw err;

    connection.query(
      "SELECT * FROM abilities WHERE card_id = ?",
      [r_id],
      (err, abilitiesData) => {
        if (err) throw err;

        connection.query(
          "SELECT * FROM weaknesses WHERE card_id = ?",
          [r_id],
          (err, weaknessesData) => {
            if (err) throw err;

            connection.query(
              "SELECT * FROM attacks WHERE card_id = ?",
              [r_id],
              (err, attacksData) => {
                if (err) throw err;

                connection.query(
                  "SELECT * FROM resistances WHERE card_id = ?",
                  [r_id],
                  (err, resistancesData) => {
                    if (err) throw err;

                    // Send the data as a JSON response
                    res.json({
                      cardData,
                      abilitiesData,
                      weaknessesData,
                      attacksData,
                      resistancesData,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Express route for adding a card to the collection
app.post("/add-to-collection", (req, res) => {
  let user_id = req.body.user_id;
  let card_id = req.body.card_id;

  console.log("Adding card to collection...");
  console.log("User ID:", user_id);
  console.log("Card ID:", card_id);

  // Construct your SQL query to insert the data into the collection table
  let addToCollectionQuery = `INSERT INTO collection (user_id, card_id) VALUES (?, ?)`;

  // Execute the query with the user_id and card_id values
  connection.query(addToCollectionQuery, [user_id, card_id], (err, result) => {
    if (err) {
      console.error("Error adding card to collection:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to add card to collection" });
    } else {
      // If the query executes successfully, send a success response
      console.log("Card added to collection successfully.");
      res.status(200).json({ success: true });
    }
  });
});

// Express route for removing a card from the collection
app.post("/remove-from-collection", (req, res) => {
  let user_id = req.body.user_id;
  let card_id = req.body.card_id;

  console.log("Removing card from collection...");
  console.log("User ID:", user_id);
  console.log("Card ID:", card_id);

  // Construct your SQL query to delete the data from the collection table
  let removeFromCollectionQuery = `DELETE FROM collection WHERE user_id = ? AND card_id = ?`;

  // Execute the query with the user_id and card_id values
  connection.query(
    removeFromCollectionQuery,
    [user_id, card_id],
    (err, result) => {
      if (err) {
        console.error("Error removing card from collection:", err);
        res.status(500).json({
          success: false,
          error: "Failed to remove card from collection",
        });
      } else {
        // If the query executes successfully, send a success response
        console.log("Card removed from collection successfully.");
        res.status(200).json({ success: true });
      }
    }
  );
});

// this returns the users collection for the my collection page
app.get("/collection/:user_id", (req, res) => {
  let user_id = req.params.user_id;
  let getCollection = `SELECT card.* FROM collection JOIN card ON collection.card_id = card.card_id WHERE collection.user_id = ?`;
  connection.query(getCollection, [user_id], (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This returns all the user collections and their associated Pokemon
app.get("/user-collections", (req, res) => {
  let getUserCollections = `
    SELECT DISTINCT user.user_id, user.username, user.first_name, user.last_name
    FROM collection 
    JOIN user ON collection.user_id = user.user_id`;
  connection.query(getUserCollections, (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// Fetch ratings for a user
app.get("/ratings/:userId", (req, res) => {
  const userId = req.params.userId;

  connection.query(
    "SELECT * FROM ratings WHERE ratee_id = ?",
    [userId],
    (error, results) => {
      if (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "An error occurred while fetching the ratings." });
      } else {
        res.status(200).json(results);
      }
    }
  );
});

// Fetch comments for a user
app.get("/comments/:userId", (req, res) => {
  const userId = req.params.userId;

  connection.query(
    "SELECT comments.*, user.username AS commenter_username FROM comments JOIN user ON comments.commenter_id = user.user_id WHERE commentee_id = ?",
    [userId],
    (error, results) => {
      if (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "An error occurred while fetching the comments." });
      } else {
        res.status(200).json(results);
      }
    }
  );
});

// This returns a specific user's collection
app.get("/user-collections/:user_id", (req, res) => {
  let userId = req.params.user_id;
  let getUserCollection = `
  SELECT collection.user_id, card.card_id, card.name, card.img
  FROM collection 
  JOIN card ON collection.card_id = card.card_id
  WHERE collection.user_id = ?`;
  connection.query(getUserCollection, [userId], (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This adds a new user rating to the ratings table in the database
app.post("/ratecollection", (req, res) => {
  let { raterId, rateeId, ratingValue } = req.body;
  let insertRating = `
  INSERT INTO ratings (rater_id, ratee_id, rating_value)
  VALUES (?, ?, ?)`;
  connection.query(
    insertRating,
    [raterId, rateeId, ratingValue],
    (err, data) => {
      if (err) throw err;
      res.json({ success: true });
    }
  );
});

// This adds a new comment to the comments table in the database
app.post("/leavecomment", (req, res) => {
  let { commenterId, commenteeId, commentText } = req.body;
  let insertComment = `
  INSERT INTO comments (commenter_id, commentee_id, comment_text)
  VALUES (?, ?, ?)`;
  connection.query(
    insertComment,
    [commenterId, commenteeId, commentText],
    (err, data) => {
      if (err) throw err;
      res.json({ success: true });
    }
  );
});

// liking another user's collection
app.post("/likecollection/:ownerUserId", (req, res) => {
  const likerUserId = req.body.liker_user_id;
  const ownerUserId = req.body.owner_user_id;

  // Insert the liked collection into the database
  connection.query(
    "INSERT INTO liked_collections (liker_user_id, owner_user_id) VALUES (?, ?)",
    [likerUserId, ownerUserId],
    (error, results) => {
      if (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "An error occurred while liking the collection." });
      } else {
        res.status(200).json({ message: "Collection liked successfully." });
      }
    }
  );
});

// this gets all the liked collections for a user
app.get("/likedcollections/:user_id", (req, res) => {
  const userId = req.params.user_id;

  const query = `
    SELECT user.username, user.user_id
    FROM liked_collections
    JOIN user ON liked_collections.owner_user_id = user.user_id
    WHERE liked_collections.liker_user_id = ?
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching data" });
    } else {
      res.json(results);
    }
  });
});

app.post("/remove-from-liked", (req, res) => {
  let liker_user_id = req.body.liker_user_id;
  let owner_user_id = req.body.owner_user_id; // Changed from collection_id

  console.log("Removing collection from liked...");
  console.log("Liker User ID:", liker_user_id);
  console.log("Owner User ID:", owner_user_id); // Changed from Collection ID

  let removeFromLikedQuery = `DELETE FROM liked_collections WHERE liker_user_id = ? AND owner_user_id = ?`;

  connection.query(
    removeFromLikedQuery,
    [liker_user_id, owner_user_id],
    (err, result) => {
      if (err) {
        console.error("Error removing collection from liked:", err);
        res.status(500).json({
          success: false,
          error: "Failed to remove collection from liked",
        });
      } else {
        console.log("Collection removed from liked successfully.");
        res.status(200).json({ success: true });
      }
    }
  );
});

// allows a user to sign up and create a new account
app.post("/signup", (req, res) => {
  let email = req.body.email;
  let username = req.body.username;
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let password = req.body.password;

  // Check if email already in database
  let checkEmail = `SELECT * FROM user WHERE email = '${email}'`;
  connection.query(checkEmail, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error checking email" });
    }

    if (data.length > 0) {
      // User with this email already exists
      return res.status(400).json({ message: "Email already in use" });
    }

    // Check if username already in database
    let checkUsername = `SELECT * FROM user WHERE username = '${username}'`;
    connection.query(checkUsername, (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error checking username" });
      }

      if (data.length > 0) {
        // User with this username already exists
        return res.status(400).json({ message: "Username already in use" });
      }

      // If email and username do not exist, create new user
      let addUser = `INSERT INTO user (email, username, first_name, last_name, password, role) 
                             VALUES('${email}', '${username}', '${firstName}', '${lastName}', '${password}', "user"); `;
      connection.query(addUser, (err, data) => {
        if (err) {
          res.status(500).json({ err });
          throw err;
        }

        if (data) {
          // Return a success status
          res.status(200).end();
        }
      });
    });
  });
});

// allows a user to login using stored user credentials from the database
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  let checkUser = `SELECT * FROM user WHERE email = '${email}' AND password = '${password}'`;

  connection.query(checkUser, (err, data) => {
    if (err) {
      console.error(err);
      res.redirect("/login"); // Redirect to login page on error
    } else {
      if (data.length > 0) {
        req.session.user = {
          ...data[0],
        };
        console.log(req.session.user);
        req.session.save((err) => {
          if (err) {
            console.error(err);
            res.redirect("/login"); // Redirect to login page on error
          } else {
            res.status(200).json({ user: req.session.user }); // Redirect to viewsets page on successful login
          }
        });
      } else {
        res.redirect("http://localhost:3000/login"); // Redirect back to login page if login fails
      }
    }
  });
});

// Fetches the user details from the database based on the user's ID passed in the URL
app.get("/user/:userId", (req, res) => {
  let userId = req.params.userId;

  let getUser = `SELECT * FROM user WHERE user_id = ${userId}`;

  connection.query(getUser, (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching user details" });
    } else {
      if (data.length > 0) {
        res.json(data[0]);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    }
  });
});

// allows a user to update their details in the database
app.post("/user/:userId", (req, res) => {
  let userId = req.params.userId;
  let { email, username, first_name, last_name, password } = req.body;

  let updateUser = `UPDATE user SET email = ?, username = ?, first_name = ?, last_name = ?, password = ? WHERE user_id = ?`;

  connection.query(
    updateUser,
    [email, username, first_name, last_name, password, userId],
    (err, data) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating user details" });
      } else {
        res.json({ message: "User details updated successfully" });
      }
    }
  );
});

// This allows a user to add a card to the card table of the database, lock off to admin if used
app.post("/app/add", (req, res) => {
  let name = req.body.nameField;
  let img = req.body.imgField;
  let hitpoints = req.body.hitpointsField;
  let rarity = req.body.rarityField;
  let illustrator = req.body.illustratorField;
  let setId = req.body.setIdField;

  let addCard = `INSERT INTO card (name, img, hitpoints, rarity, illustrator, set_id) 
                     VALUES('${name}', '${img}', ${hitpoints}, '${rarity}', '${illustrator}', ${setId}); `;

  connection.query(addCard, (err, data) => {
    if (err) {
      res.json({ err });
      throw err;
    }

    if (data) {
      let respObj = {
        id: data.insertId,
        name: name,
        message: `${name} card added to collection`,
      };
      res.json({ respObj });
    }
  });
});

// Starts the api and listen for HTTP requests on port 4000
const server = app.listen(PORT, () => {
  console.log(`API started on port ${server.address().port}`);
});
