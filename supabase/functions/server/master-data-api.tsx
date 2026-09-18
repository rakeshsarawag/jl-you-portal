import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Helper: determine if a Postgres error means the table doesn't exist
function isTableMissingError(error: any): boolean {
  return (
    error?.code === "PGRST116" ||
    error?.code === "42P01" ||
    (typeof error?.message === "string" && error.message.includes("does not exist"))
  );
}

// ==================== DEPARTMENTS ====================

app.get("/departments", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_departments")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return c.json({ error: "Failed to fetch departments" }, 500);
  }
});

app.get("/departments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_departments")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Department not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Department not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching department:", error);
    return c.json({ error: "Failed to fetch department" }, 500);
  }
});

app.post("/departments", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_departments")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating department:", error);
    return c.json({ error: "Failed to create department" }, 500);
  }
});

app.put("/departments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_departments")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating department:", error);
    return c.json({ error: "Failed to update department" }, 500);
  }
});

app.delete("/departments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_departments")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return c.json({ error: "Failed to delete department" }, 500);
  }
});

// ==================== LOCATIONS ====================

app.get("/locations", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_locations")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return c.json({ error: "Failed to fetch locations" }, 500);
  }
});

app.get("/locations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_locations")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Location not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Location not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching location:", error);
    return c.json({ error: "Failed to fetch location" }, 500);
  }
});

app.post("/locations", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_locations")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating location:", error);
    return c.json({ error: "Failed to create location" }, 500);
  }
});

app.put("/locations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_locations")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating location:", error);
    return c.json({ error: "Failed to update location" }, 500);
  }
});

app.delete("/locations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_locations")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting location:", error);
    return c.json({ error: "Failed to delete location" }, 500);
  }
});

// ==================== JOB TITLES ====================

app.get("/job-titles", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_job_titles")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching job titles:", error);
    return c.json({ error: "Failed to fetch job titles" }, 500);
  }
});

app.get("/job-titles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_job_titles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Job title not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Job title not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching job title:", error);
    return c.json({ error: "Failed to fetch job title" }, 500);
  }
});

app.post("/job-titles", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_job_titles")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating job title:", error);
    return c.json({ error: "Failed to create job title" }, 500);
  }
});

app.put("/job-titles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_job_titles")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating job title:", error);
    return c.json({ error: "Failed to update job title" }, 500);
  }
});

app.delete("/job-titles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_job_titles")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting job title:", error);
    return c.json({ error: "Failed to delete job title" }, 500);
  }
});

// ==================== CLIENTS ====================

app.get("/clients", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_clients")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
});

app.get("/clients/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_clients")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Client not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Client not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching client:", error);
    return c.json({ error: "Failed to fetch client" }, 500);
  }
});

app.post("/clients", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_clients")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating client:", error);
    return c.json({ error: "Failed to create client" }, 500);
  }
});

app.put("/clients/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_clients")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating client:", error);
    return c.json({ error: "Failed to update client" }, 500);
  }
});

app.delete("/clients/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_clients")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return c.json({ error: "Failed to delete client" }, 500);
  }
});

// ==================== EMPLOYMENT TYPES ====================

app.get("/employment-types", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_employment_types")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching employment types:", error);
    return c.json({ error: "Failed to fetch employment types" }, 500);
  }
});

app.get("/employment-types/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_employment_types")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Employment type not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Employment type not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching employment type:", error);
    return c.json({ error: "Failed to fetch employment type" }, 500);
  }
});

app.post("/employment-types", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_employment_types")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating employment type:", error);
    return c.json({ error: "Failed to create employment type" }, 500);
  }
});

app.put("/employment-types/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_employment_types")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating employment type:", error);
    return c.json({ error: "Failed to update employment type" }, 500);
  }
});

app.delete("/employment-types/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_employment_types")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting employment type:", error);
    return c.json({ error: "Failed to delete employment type" }, 500);
  }
});

// ==================== SKILLS ====================

app.get("/skills", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_skills")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching skills:", error);
    return c.json({ error: "Failed to fetch skills" }, 500);
  }
});

app.get("/skills/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_skills")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Skill not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Skill not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching skill:", error);
    return c.json({ error: "Failed to fetch skill" }, 500);
  }
});

app.post("/skills", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_skills")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating skill:", error);
    return c.json({ error: "Failed to create skill" }, 500);
  }
});

app.put("/skills/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_skills")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating skill:", error);
    return c.json({ error: "Failed to update skill" }, 500);
  }
});

app.delete("/skills/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_skills")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting skill:", error);
    return c.json({ error: "Failed to delete skill" }, 500);
  }
});

// ==================== CURRENCIES ====================

app.get("/currencies", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_currencies")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching currencies:", error);
    return c.json({ error: "Failed to fetch currencies" }, 500);
  }
});

app.get("/currencies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_currencies")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Currency not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Currency not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching currency:", error);
    return c.json({ error: "Failed to fetch currency" }, 500);
  }
});

app.post("/currencies", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_currencies")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating currency:", error);
    return c.json({ error: "Failed to create currency" }, 500);
  }
});

app.put("/currencies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_currencies")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating currency:", error);
    return c.json({ error: "Failed to update currency" }, 500);
  }
});

app.delete("/currencies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_currencies")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting currency:", error);
    return c.json({ error: "Failed to delete currency" }, 500);
  }
});

// ==================== VALUE HELPS ====================

app.get("/value-helps", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_value_helps")
      .select("*")
      .order("label", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching value helps:", error);
    return c.json({ error: "Failed to fetch value helps" }, 500);
  }
});

app.get("/value-helps/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_value_helps")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Value help not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Value help not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching value help:", error);
    return c.json({ error: "Failed to fetch value help" }, 500);
  }
});

app.post("/value-helps", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_value_helps")
      .insert({ ...body, id })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating value help:", error);
    return c.json({ error: "Failed to create value help" }, 500);
  }
});

// Bulk upsert — used by seed scripts and migrations.
// Body: { rows: Array<{ entity, field, label, value, sort_order?, is_active? }> }
app.post("/value-helps/seed", async (c) => {
  try {
    const { rows } = await c.req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return c.json({ error: "rows array required" }, 400);
    }
    const supabase = getSupabase();
    const records = rows.map((r: any) => ({
      id: crypto.randomUUID(),
      entity: r.entity,
      field: r.field,
      label: r.label,
      value: r.value,
      sort_order: r.sort_order ?? 0,
      is_active: r.is_active ?? true,
    }));
    const { error } = await supabase
      .from("master_value_helps")
      .upsert(records, { onConflict: "entity,field,value", ignoreDuplicates: false });
    if (error) throw error;
    return c.json({ success: true, count: records.length });
  } catch (error) {
    console.error("Error seeding value helps:", error);
    return c.json({ error: "Failed to seed value helps" }, 500);
  }
});

app.put("/value-helps/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("master_value_helps")
      .update({ ...body, id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating value help:", error);
    return c.json({ error: "Failed to update value help" }, 500);
  }
});

app.delete("/value-helps/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase
      .from("master_value_helps")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting value help:", error);
    return c.json({ error: "Failed to delete value help" }, 500);
  }
});

// ==================== HOLIDAYS ====================

app.get("/holidays", async (c) => {
  try {
    const year = c.req.query("year");
    const supabase = getSupabase();
    let query = supabase.from("holidays").select("*").order("date", { ascending: true });
    if (year) {
      query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
    }
    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return c.json({ error: "Failed to fetch holidays" }, 500);
  }
});

app.post("/holidays", async (c) => {
  try {
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("holidays")
      .insert({ ...body, id: body.id || crypto.randomUUID() })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating holiday:", error);
    return c.json({ error: "Failed to create holiday" }, 500);
  }
});

app.put("/holidays/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("holidays")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating holiday:", error);
    return c.json({ error: "Failed to update holiday" }, 500);
  }
});

app.delete("/holidays/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    return c.json({ error: "Failed to delete holiday" }, 500);
  }
});

// ==================== LEAVE POLICIES ====================

app.get("/leave-policies", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("leave_policies")
      .select("*")
      .order("leave_type", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching leave policies:", error);
    return c.json({ error: "Failed to fetch leave policies" }, 500);
  }
});

app.post("/leave-policies", async (c) => {
  try {
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("leave_policies")
      .insert({ ...body, id: body.id || crypto.randomUUID() })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating leave policy:", error);
    return c.json({ error: "Failed to create leave policy" }, 500);
  }
});

app.put("/leave-policies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("leave_policies")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating leave policy:", error);
    return c.json({ error: "Failed to update leave policy" }, 500);
  }
});

// ==================== EMAIL TEMPLATES ====================

app.get("/email-templates", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return c.json({ error: "Failed to fetch email templates" }, 500);
  }
});

app.put("/email-templates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("email_templates")
      .update({ subject: body.subject, body: body.body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating email template:", error);
    return c.json({ error: "Failed to update email template" }, 500);
  }
});

// ==================== TICKET CATEGORIES ====================

const TICKET_CATEGORIES_SEED = [
  { id: "cat-1", name: "Hardware", description: "Hardware issues", is_active: true, sort_order: 1 },
  { id: "cat-2", name: "Software/App", description: "Software and application issues", is_active: true, sort_order: 2 },
  { id: "cat-3", name: "Network/VPN", description: "Network and VPN connectivity", is_active: true, sort_order: 3 },
  { id: "cat-4", name: "Access & Permissions", description: "Access requests", is_active: true, sort_order: 4 },
  { id: "cat-5", name: "Email & Calendar", description: "Email and calendar issues", is_active: true, sort_order: 5 },
  { id: "cat-6", name: "Security", description: "Security incidents", is_active: true, sort_order: 6 },
  { id: "cat-7", name: "General/Other", description: "General requests", is_active: true, sort_order: 7 },
];

app.get("/ticket-categories", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_ticket_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: TICKET_CATEGORIES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching ticket categories:", error);
    return c.json({ error: "Failed to fetch ticket categories" }, 500);
  }
});

app.get("/ticket-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_ticket_categories")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Ticket category not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Ticket category not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching ticket category:", error);
    return c.json({ error: "Failed to fetch ticket category" }, 500);
  }
});

app.post("/ticket-categories", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_ticket_categories")
      .insert({
        id,
        name: body.name,
        description: body.description,
        icon: body.icon ?? "folder",
        sort_order: body.sortOrder ?? 0,
        default_sla_policy_id: body.defaultSlaPolicyId,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating ticket category:", error);
    return c.json({ error: "Failed to create ticket category" }, 500);
  }
});

app.put("/ticket-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_ticket_categories")
      .update({
        name: body.name,
        description: body.description,
        icon: body.icon,
        sort_order: body.sortOrder,
        default_sla_policy_id: body.defaultSlaPolicyId,
        is_active: body.isActive,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating ticket category:", error);
    return c.json({ error: "Failed to update ticket category" }, 500);
  }
});

app.delete("/ticket-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("it_ticket_categories").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket category:", error);
    return c.json({ error: "Failed to delete ticket category" }, 500);
  }
});

// ==================== SLA POLICIES ====================

const SLA_POLICIES_SEED = [
  { id: "sla-1", name: "P1-Critical", priority: "Critical", first_response_mins: 240, resolution_mins: 480, business_hours_only: false, is_active: true },
  { id: "sla-2", name: "P2-High", priority: "High", first_response_mins: 480, resolution_mins: 1440, business_hours_only: true, is_active: true },
  { id: "sla-3", name: "P3-Medium", priority: "Medium", first_response_mins: 960, resolution_mins: 2880, business_hours_only: true, is_active: true },
  { id: "sla-4", name: "P4-Low", priority: "Low", first_response_mins: 1440, resolution_mins: 4320, business_hours_only: true, is_active: true },
];

app.get("/sla-policies", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_sla_policies")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: SLA_POLICIES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching SLA policies:", error);
    return c.json({ error: "Failed to fetch SLA policies" }, 500);
  }
});

app.get("/sla-policies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_sla_policies")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "SLA policy not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "SLA policy not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching SLA policy:", error);
    return c.json({ error: "Failed to fetch SLA policy" }, 500);
  }
});

app.post("/sla-policies", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_sla_policies")
      .insert({
        id,
        name: body.name,
        priority: body.priority,
        first_response_mins: body.firstResponseMins,
        resolution_mins: body.resolutionMins,
        business_hours_only: body.businessHoursOnly ?? true,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating SLA policy:", error);
    return c.json({ error: "Failed to create SLA policy" }, 500);
  }
});

app.put("/sla-policies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_sla_policies")
      .update({
        name: body.name,
        priority: body.priority,
        first_response_mins: body.firstResponseMins,
        resolution_mins: body.resolutionMins,
        business_hours_only: body.businessHoursOnly,
        is_active: body.isActive,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating SLA policy:", error);
    return c.json({ error: "Failed to update SLA policy" }, 500);
  }
});

app.delete("/sla-policies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("it_sla_policies").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting SLA policy:", error);
    return c.json({ error: "Failed to delete SLA policy" }, 500);
  }
});

// ==================== VENDORS ====================

const VENDORS_SEED = [
  { id: "v-1", name: "Dell Technologies", code: "DELL", country: "USA", is_active: true },
  { id: "v-2", name: "Apple Inc.", code: "AAPL", country: "USA", is_active: true },
  { id: "v-3", name: "HP Inc.", code: "HP", country: "USA", is_active: true },
  { id: "v-4", name: "Lenovo", code: "LEN", country: "China", is_active: true },
  { id: "v-5", name: "Cisco Systems", code: "CSCO", country: "USA", is_active: true },
  { id: "v-6", name: "Microsoft", code: "MSFT", country: "USA", is_active: true },
  { id: "v-7", name: "Samsung", code: "SAM", country: "South Korea", is_active: true },
  { id: "v-8", name: "LG Electronics", code: "LGE", country: "South Korea", is_active: true },
];

app.get("/vendors", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_vendors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: VENDORS_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return c.json({ error: "Failed to fetch vendors" }, 500);
  }
});

app.get("/vendors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_vendors")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Vendor not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Vendor not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return c.json({ error: "Failed to fetch vendor" }, 500);
  }
});

app.post("/vendors", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_vendors")
      .insert({
        id,
        name: body.name,
        code: body.code,
        email: body.email,
        phone: body.phone,
        website: body.website,
        country: body.country,
        is_active: body.isActive ?? true,
        notes: body.notes,
      })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating vendor:", error);
    return c.json({ error: "Failed to create vendor" }, 500);
  }
});

app.put("/vendors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_vendors")
      .update({
        name: body.name,
        code: body.code,
        email: body.email,
        phone: body.phone,
        website: body.website,
        country: body.country,
        is_active: body.isActive,
        notes: body.notes,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return c.json({ error: "Failed to update vendor" }, 500);
  }
});

app.delete("/vendors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("asset_vendors").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return c.json({ error: "Failed to delete vendor" }, 500);
  }
});

// ==================== ASSET CATEGORIES ====================

const ASSET_CATEGORIES_SEED = [
  { id: "ac-1", name: "Laptop", slug: "laptop", depreciation_years: 3, warranty_months: 12, is_active: true },
  { id: "ac-2", name: "Desktop", slug: "desktop", depreciation_years: 4, warranty_months: 12, is_active: true },
  { id: "ac-3", name: "Server", slug: "server", depreciation_years: 5, warranty_months: 36, is_active: true },
  { id: "ac-4", name: "Network Equipment", slug: "network", depreciation_years: 5, warranty_months: 24, is_active: true },
  { id: "ac-5", name: "Mobile Phone", slug: "mobile", depreciation_years: 2, warranty_months: 12, is_active: true },
  { id: "ac-6", name: "Monitor", slug: "monitor", depreciation_years: 4, warranty_months: 12, is_active: true },
  { id: "ac-7", name: "Printer", slug: "printer", depreciation_years: 4, warranty_months: 12, is_active: true },
];

app.get("/asset-categories", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: ASSET_CATEGORIES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching asset categories:", error);
    return c.json({ error: "Failed to fetch asset categories" }, 500);
  }
});

app.get("/asset-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_categories")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ error: "Asset category not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ error: "Asset category not found" }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching asset category:", error);
    return c.json({ error: "Failed to fetch asset category" }, 500);
  }
});

app.post("/asset-categories", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_categories")
      .insert({
        id,
        name: body.name,
        slug: body.slug,
        depreciation_years: body.depreciationYears ?? 3,
        warranty_months: body.warrantyMonths ?? 12,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating asset category:", error);
    return c.json({ error: "Failed to create asset category" }, 500);
  }
});

app.put("/asset-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_categories")
      .update({
        name: body.name,
        slug: body.slug,
        depreciation_years: body.depreciationYears,
        warranty_months: body.warrantyMonths,
        is_active: body.isActive,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating asset category:", error);
    return c.json({ error: "Failed to update asset category" }, 500);
  }
});

app.delete("/asset-categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("asset_categories").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset category:", error);
    return c.json({ error: "Failed to delete asset category" }, 500);
  }
});

// ==================== MAINTENANCE TYPES ====================

const MAINTENANCE_TYPES_SEED = [
  { id: "mt-1", name: "Preventive", is_active: true },
  { id: "mt-2", name: "Corrective", is_active: true },
  { id: "mt-3", name: "Inspection", is_active: true },
  { id: "mt-4", name: "Upgrade", is_active: true },
  { id: "mt-5", name: "Cleaning", is_active: true },
  { id: "mt-6", name: "Calibration", is_active: true },
];

app.get("/maintenance-types", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_maintenance_types")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: MAINTENANCE_TYPES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching maintenance types:", error);
    return c.json({ error: "Failed to fetch maintenance types" }, 500);
  }
});

app.post("/maintenance-types", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_maintenance_types")
      .insert({ id, name: body.name, is_active: body.isActive ?? true })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating maintenance type:", error);
    return c.json({ error: "Failed to create maintenance type" }, 500);
  }
});

app.put("/maintenance-types/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("asset_maintenance_types")
      .update({ name: body.name, is_active: body.isActive })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating maintenance type:", error);
    return c.json({ error: "Failed to update maintenance type" }, 500);
  }
});

app.delete("/maintenance-types/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("asset_maintenance_types").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting maintenance type:", error);
    return c.json({ error: "Failed to delete maintenance type" }, 500);
  }
});

// ==================== PROJECT METHODOLOGIES ====================

const PROJECT_METHODOLOGIES_SEED = [
  { id: "pm-1", name: "Scrum", is_active: true },
  { id: "pm-2", name: "Kanban", is_active: true },
  { id: "pm-3", name: "Waterfall", is_active: true },
  { id: "pm-4", name: "Hybrid", is_active: true },
];

app.get("/project-methodologies", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("project_methodologies")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: PROJECT_METHODOLOGIES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching project methodologies:", error);
    return c.json({ error: "Failed to fetch project methodologies" }, 500);
  }
});

app.post("/project-methodologies", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("project_methodologies")
      .insert({ id, name: body.name, is_active: body.isActive ?? true })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating project methodology:", error);
    return c.json({ error: "Failed to create project methodology" }, 500);
  }
});

app.put("/project-methodologies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("project_methodologies")
      .update({ name: body.name, is_active: body.isActive })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating project methodology:", error);
    return c.json({ error: "Failed to update project methodology" }, 500);
  }
});

app.delete("/project-methodologies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("project_methodologies").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting project methodology:", error);
    return c.json({ error: "Failed to delete project methodology" }, 500);
  }
});

// ==================== RESOLUTION CODES ====================

const RESOLUTION_CODES_SEED = [
  { id: "rc-1", name: "Fixed", is_active: true },
  { id: "rc-2", name: "Workaround", is_active: true },
  { id: "rc-3", name: "Duplicate", is_active: true },
  { id: "rc-4", name: "Cannot Reproduce", is_active: true },
  { id: "rc-5", name: "User Error", is_active: true },
  { id: "rc-6", name: "No Action Required", is_active: true },
  { id: "rc-7", name: "Known Issue", is_active: true },
];

app.get("/resolution-codes", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_resolution_codes")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: RESOLUTION_CODES_SEED });
      throw error;
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error fetching resolution codes:", error);
    return c.json({ error: "Failed to fetch resolution codes" }, 500);
  }
});

app.post("/resolution-codes", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_resolution_codes")
      .insert({ id, name: body.name, is_active: body.isActive ?? true })
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } }, 201);
      throw error;
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating resolution code:", error);
    return c.json({ error: "Failed to create resolution code" }, 500);
  }
});

app.put("/resolution-codes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("it_resolution_codes")
      .update({ name: body.name, is_active: body.isActive })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true, data: { id, ...body } });
      throw error;
    }
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating resolution code:", error);
    return c.json({ error: "Failed to update resolution code" }, 500);
  }
});

app.delete("/resolution-codes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("it_resolution_codes").delete().eq("id", id);
    if (error) {
      if (isTableMissingError(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting resolution code:", error);
    return c.json({ error: "Failed to delete resolution code" }, 500);
  }
});

export default app;
