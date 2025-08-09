import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite3v = sqlite3.verbose();

var dbFile = path.join(__dirname, '/../db/annotation.sqlite');
console.log('dbFile: ', dbFile);
var db = new sqlite3v.Database(dbFile);

/* This class is used to add annotation on a give path */
var Annotation = function() {
    var serialize = function(cb) {
        db.serialize(cb);
    }

    var prepareTable = function() {
        /* view is how to view the note, e.g. html or markdown */
        db.run("CREATE TABLE if not exists notes (ID INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, note TEXT, view TEXT)", function(err) {
            if (err) {
                console.log('Create table error: ', err);
            }
        });

        //just store modifedDate as string, as we do not need to query agaisnt it. It is a ISO Datetime string.
        db.run("CREATE TABLE if not exists attachments (ID INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, file_name TEXT, file_size INTEGER, file_modifiedDate TEXT, saved_path TEXT)", function(err) {
            if (err) {
                console.log('Create table error: ', err);
            }
        });

        db.run("CREATE TABLE if not exists filters (ID INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, filter TEXT)", function(err) {
            if (err) {
                console.log('Create table error: ', err);
            }
        });
    }

    //Reset the database!
    var reset = function() {
        db.serialize( function() {
            prepareTable();
            db.run("DELETE FROM notes");
            db.run("DELETE FROM attachments");
            db.run("DELETE FROM filters");
        });
    }

    //FIXME: this is for single note per path, do we need to support multiple notes per path!?
    var addNote = function(path, note, view, cb) {
        //db.run("INSERT INTO notes (path, note) VALUES (?,?)", path, note, function(err) {
        //view can be HTML (raw) or markdown
        view = view || 'html';

        db.run("INSERT OR REPLACE INTO notes (ID, path, note, view) VALUES ((SELECT ID FROM notes WHERE path = ?), ?, ?, ?)", path, path, note, view, function(err) {
            if (typeof(cb)!='undefined'){
                cb(err);
            }
        })
    }

    var setFilter = function(path, filter, cb) {
        db.run("INSERT OR REPLACE INTO filters (ID, path, filter) VALUES ((SELECT ID FROM filters WHERE path = ?), ?, ?)", path, path, filter, function(err) {
            if (typeof(cb)!='undefined'){
                if (err) {
                    console.log('setFilter error: ', err);
                }
                cb(err);
            }
        })
    }


    var getNote = function(path, cb) {
        db.all("SELECT * FROM notes WHERE path=?", path, function(err, rows) {
            //console.log('found rows: ', rows.length, rows[0]);
            if (typeof(cb)!='undefined') {
                if (err) {
                    //some error happened when querying database!
                    cb(err);
                }
                else if (rows.length > 0) {
                    cb(null, rows[0].note);
                }
                else cb(null, '');  //no note defined at thsi location
            }

        });
    }

    var getFilter = function(path, cb) {
        db.all("SELECT * FROM filters WHERE path=?", path, function(err, rows) {
            if (typeof(cb)!='undefined') {
                if (err) {
                    //some error happened when querying database!
                    cb(err);
                }
                else if (rows.length > 0) {
                    cb(null, rows[0].filter);
                }
                else cb(null, '');  //no filter defined at this location yet!
            }
        });
    }

    var addAttachment = function(path, file_name, file_size, file_modifiedDate, saved_path, cb) {
        db.run("INSERT INTO attachments (path, file_name, file_size, file_modifiedDate, saved_path) VALUES (?, ?, ?, ?, ?)", path, file_name, file_size, file_modifiedDate, saved_path, function(err) {
            if (typeof(cb)!='undefined'){
                cb(err);
            }
        })
    }

    var getAttachments = function(path, cb) {
        db.all("SELECT * FROM attachments WHERE path=?", path, function(err, rows) {
            if (typeof(cb)!='undefined') {
                cb(err, rows);
            }
        });
    }

    /* Since the filename on the shadow file system is coded, use this to retrieve the origninal file name (and maybe modifiedDate, etc.) */
    /* This should return only one attachment file */
    var getAttachmentBySavedPath = function(saved_path, cb) {
        console.log('getAttachmentBySavedPath ', saved_path);
        db.all("SELECT * FROM attachments WHERE saved_path=?", saved_path, function(err, rows) {
            if (typeof(cb)!='undefined') {
                if (!err && rows.length > 0) {
                    cb(err, rows[0]);
                }
                else {
                    cb(err, null); //File not found or something!
                }

            }
        });
    }

    //for testing!
    var browse = function() {
        console.log('Existing attachments:')

        db.each("SELECT * FROM attachments", function(err, rows) {
            //console.log('Existing notes:')
            console.log(rows);
            //console.log(row.path + ': ' + row.note);
        })
    }

    var close = function() {
        db.close();
    }

    prepareTable();

    this.reset = reset;
    this.addNote = addNote;
    this.getNote = getNote;

    this.addAttachment = addAttachment;
    this.getAttachments = getAttachments;

    this.getAttachmentBySavedPath = getAttachmentBySavedPath;

    this.setFilter = setFilter;
    this.getFilter = getFilter;

    this.browse = browse;
    this.close = close;
    this.serialize = serialize;


}

export default Annotation