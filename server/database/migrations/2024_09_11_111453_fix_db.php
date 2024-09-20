<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('visibility')->default('public');
            $table->dropForeign(['id_creator']);
            $table->dropColumn('id_creator');
        });

        Schema::table('user_event', function (Blueprint $table) {
            $table->boolean('is_creator')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
