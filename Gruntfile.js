module.exports = function(grunt) {
    "use strict";

    grunt.loadNpmTasks("grunt-contrib-compress");

    grunt.initConfig({
        compress: {
            dist: {
                "options": {
                    archive: "vsroom.tar.gz",
                    mode: "tgz"
                },

                files: [{
                        expand: true,
                        cwd: "vsr",
                        src: ["**/*"],
                        dest: "vsroom-dist"
                }]
            }
        }
    });

    grunt.registerTask("makedist", [
        "compress:dist"
    ]);
}

