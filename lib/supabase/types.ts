export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      contract_volumes: {
        Row: {
          actual_volume: number | null
          contract_id: string | null
          id: string
          invoice_number: string | null
          invoice_status: string | null
          month: string
          payment_date: string | null
          planned_volume: number
          status: string | null
        }
        Insert: {
          actual_volume?: number | null
          contract_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          month: string
          payment_date?: string | null
          planned_volume: number
          status?: string | null
        }
        Update: {
          actual_volume?: number | null
          contract_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          month?: string
          payment_date?: string | null
          planned_volume?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_volumes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean | null
          buyer: string
          created_at: string | null
          end_date: string | null
          id: string
          incoterm: string | null
          is_active: boolean | null
          name: string
          payment_terms: string | null
          price_per_tonne: number
          renewal_date: string | null
          start_date: string | null
          status: string
          termination_notice_days: number | null
        }
        Insert: {
          auto_renew?: boolean | null
          buyer: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          incoterm?: string | null
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          price_per_tonne: number
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          termination_notice_days?: number | null
        }
        Update: {
          auto_renew?: boolean | null
          buyer?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          incoterm?: string | null
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          price_per_tonne?: number
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          termination_notice_days?: number | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          approved_by: string | null
          buy_price_per_tonne: number
          buyer: string
          created_at: string | null
          created_by: string | null
          deal_id: string
          deal_type: string
          disport: string
          end_month: string | null
          funding_rate: number | null
          id: string
          input_product: string
          margin: number | null
          name: string
          notes: string | null
          output_product: string
          payment_type: string | null
          pre_funding_required: number | null
          producer: string
          profit: number | null
          profit_per_tonne: number | null
          sell_price_per_tonne: number
          shipping_per_tonne: number | null
          start_month: string | null
          status: string
          tonnes: number
          total_cost: number | null
          total_revenue: number | null
          trucking_per_tonne: number | null
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          approved_by?: string | null
          buy_price_per_tonne: number
          buyer: string
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          deal_type: string
          disport?: string
          end_month?: string | null
          funding_rate?: number | null
          id?: string
          input_product?: string
          margin?: number | null
          name: string
          notes?: string | null
          output_product?: string
          payment_type?: string | null
          pre_funding_required?: number | null
          producer?: string
          profit?: number | null
          profit_per_tonne?: number | null
          sell_price_per_tonne: number
          shipping_per_tonne?: number | null
          start_month?: string | null
          status?: string
          tonnes: number
          total_cost?: number | null
          total_revenue?: number | null
          trucking_per_tonne?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          approved_by?: string | null
          buy_price_per_tonne?: number
          buyer?: string
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          deal_type?: string
          disport?: string
          end_month?: string | null
          funding_rate?: number | null
          id?: string
          input_product?: string
          margin?: number | null
          name?: string
          notes?: string | null
          output_product?: string
          payment_type?: string | null
          pre_funding_required?: number | null
          producer?: string
          profit?: number | null
          profit_per_tonne?: number | null
          sell_price_per_tonne?: number
          shipping_per_tonne?: number | null
          start_month?: string | null
          status?: string
          tonnes?: number
          total_cost?: number | null
          total_revenue?: number | null
          trucking_per_tonne?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          document_type: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          source: string
          source_folder: string | null
          source_modified_at: string | null
          source_path: string | null
          source_ref: string | null
          synced_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          document_type: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          source?: string
          source_folder?: string | null
          source_modified_at?: string | null
          source_path?: string | null
          source_ref?: string | null
          synced_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          document_type?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          source?: string
          source_folder?: string | null
          source_modified_at?: string | null
          source_path?: string | null
          source_ref?: string | null
          synced_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string | null
          effective_date?: string
          from_currency: string
          id?: string
          rate: number
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string | null
          to_currency?: string
        }
        Relationships: []
      }
      finance_exports: {
        Row: {
          data: Json
          export_type: string
          exported_at: string | null
          exported_by: string | null
          finance_acknowledged: boolean | null
          id: string
          month: string
          sent_to_finance: boolean | null
        }
        Insert: {
          data: Json
          export_type: string
          exported_at?: string | null
          exported_by?: string | null
          finance_acknowledged?: boolean | null
          id?: string
          month: string
          sent_to_finance?: boolean | null
        }
        Update: {
          data?: Json
          export_type?: string
          exported_at?: string | null
          exported_by?: string | null
          finance_acknowledged?: boolean | null
          id?: string
          month?: string
          sent_to_finance?: boolean | null
        }
        Relationships: []
      }
      inventory_consumption: {
        Row: {
          actual_kg: number
          created_at: string | null
          id: string
          material: string
          planned_kg: number
          production_batch_id: string | null
          production_month: string
          recorded_at: string | null
          recorded_by: string | null
          variance_kg: number | null
          variance_pct: number | null
        }
        Insert: {
          actual_kg?: number
          created_at?: string | null
          id?: string
          material: string
          planned_kg?: number
          production_batch_id?: string | null
          production_month: string
          recorded_at?: string | null
          recorded_by?: string | null
          variance_kg?: number | null
          variance_pct?: number | null
        }
        Update: {
          actual_kg?: number
          created_at?: string | null
          id?: string
          material?: string
          planned_kg?: number
          production_batch_id?: string | null
          production_month?: string
          recorded_at?: string | null
          recorded_by?: string | null
          variance_kg?: number | null
          variance_pct?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_omr: number | null
          amount_usd: number
          buyer: string
          created_at: string | null
          deal_id: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: string
        }
        Insert: {
          amount_omr?: number | null
          amount_usd: number
          buyer: string
          created_at?: string | null
          deal_id?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
        }
        Update: {
          amount_omr?: number | null
          amount_usd?: number
          buyer?: string
          created_at?: string | null
          deal_id?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
        }
        Relationships: []
      }
      iscc_certificates: {
        Row: {
          certificate_number: string | null
          created_at: string | null
          entity_name: string
          entity_type: string
          expiry_date: string | null
          ghg_savings_percent: number | null
          id: string
          issue_date: string | null
          notes: string | null
          scope: string | null
          status: string | null
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string | null
          entity_name: string
          entity_type: string
          expiry_date?: string | null
          ghg_savings_percent?: number | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          scope?: string | null
          status?: string | null
        }
        Update: {
          certificate_number?: string | null
          created_at?: string | null
          entity_name?: string
          entity_type?: string
          expiry_date?: string | null
          ghg_savings_percent?: number | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          scope?: string | null
          status?: string | null
        }
        Relationships: []
      }
      maintenance_schedule: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string | null
          equipment_name: string
          id: string
          maintenance_type: string
          notes: string | null
          priority: string
          scheduled_date: string
          status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          equipment_name: string
          id?: string
          maintenance_type?: string
          notes?: string | null
          priority?: string
          scheduled_date: string
          status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          equipment_name?: string
          id?: string
          maintenance_type?: string
          notes?: string | null
          priority?: string
          scheduled_date?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_email: string | null
          body: string
          channel_id: string
          created_at: string | null
          id: string
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          author_email?: string | null
          body: string
          channel_id: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          author_email?: string | null
          body?: string
          channel_id?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_forecast: {
        Row: {
          arb_capped: number | null
          arb_cost: number | null
          arb_profit: number | null
          arb_required: number | null
          arb_revenue: number | null
          avg_contract_price: number | null
          b100_produced: number | null
          barka_output: number | null
          calculated_at: string | null
          closing_stock: number | null
          gap: number | null
          glycerin_produced: number | null
          id: string
          month: string
          opening_stock: number | null
          production_cogs: number | null
          production_profit: number | null
          production_revenue: number | null
          shortfall: number | null
          stock_warning: boolean | null
          total_committed: number | null
          total_profit: number | null
          uco_needed: number | null
          working_capital_needed: number | null
        }
        Insert: {
          arb_capped?: number | null
          arb_cost?: number | null
          arb_profit?: number | null
          arb_required?: number | null
          arb_revenue?: number | null
          avg_contract_price?: number | null
          b100_produced?: number | null
          barka_output?: number | null
          calculated_at?: string | null
          closing_stock?: number | null
          gap?: number | null
          glycerin_produced?: number | null
          id?: string
          month: string
          opening_stock?: number | null
          production_cogs?: number | null
          production_profit?: number | null
          production_revenue?: number | null
          shortfall?: number | null
          stock_warning?: boolean | null
          total_committed?: number | null
          total_profit?: number | null
          uco_needed?: number | null
          working_capital_needed?: number | null
        }
        Update: {
          arb_capped?: number | null
          arb_cost?: number | null
          arb_profit?: number | null
          arb_required?: number | null
          arb_revenue?: number | null
          avg_contract_price?: number | null
          b100_produced?: number | null
          barka_output?: number | null
          calculated_at?: string | null
          closing_stock?: number | null
          gap?: number | null
          glycerin_produced?: number | null
          id?: string
          month?: string
          opening_stock?: number | null
          production_cogs?: number | null
          production_profit?: number | null
          production_revenue?: number | null
          shortfall?: number | null
          stock_warning?: boolean | null
          total_committed?: number | null
          total_profit?: number | null
          uco_needed?: number | null
          working_capital_needed?: number | null
        }
        Relationships: []
      }
      price_feeds: {
        Row: {
          commodity: string
          created_at: string | null
          id: string
          price_date: string
          price_usd: number
          source: string | null
        }
        Insert: {
          commodity: string
          created_at?: string | null
          id?: string
          price_date?: string
          price_usd: number
          source?: string | null
        }
        Update: {
          commodity?: string
          created_at?: string | null
          id?: string
          price_date?: string
          price_usd?: number
          source?: string | null
        }
        Relationships: []
      }
      prices: {
        Row: {
          created_at: string | null
          effective_date: string
          id: string
          price_type: string
          source: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          id?: string
          price_type: string
          source?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          id?: string
          price_type?: string
          source?: string | null
          value?: number
        }
        Relationships: []
      }
      production_actuals: {
        Row: {
          actual_revenue: number
          actual_volume_tonnes: number
          created_at: string | null
          deal_id: string | null
          id: string
          month: string
          notes: string | null
          planned_revenue: number
          planned_volume_tonnes: number
          recorded_at: string | null
          recorded_by: string | null
          revenue_variance: number | null
          volume_variance_pct: number | null
          volume_variance_tonnes: number | null
        }
        Insert: {
          actual_revenue?: number
          actual_volume_tonnes?: number
          created_at?: string | null
          deal_id?: string | null
          id?: string
          month: string
          notes?: string | null
          planned_revenue?: number
          planned_volume_tonnes?: number
          recorded_at?: string | null
          recorded_by?: string | null
          revenue_variance?: number | null
          volume_variance_pct?: number | null
          volume_variance_tonnes?: number | null
        }
        Update: {
          actual_revenue?: number
          actual_volume_tonnes?: number
          created_at?: string | null
          deal_id?: string | null
          id?: string
          month?: string
          notes?: string | null
          planned_revenue?: number
          planned_volume_tonnes?: number
          recorded_at?: string | null
          recorded_by?: string | null
          revenue_variance?: number | null
          volume_variance_pct?: number | null
          volume_variance_tonnes?: number | null
        }
        Relationships: []
      }
      production_confirmations: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          deal_id: string | null
          id: string
          issue_flag: string | null
          issue_reason: string | null
          materials_ordered: boolean | null
          production_month: string | null
          slot_reserved: boolean | null
          status: string | null
          tonnage: number | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          issue_flag?: string | null
          issue_reason?: string | null
          materials_ordered?: boolean | null
          production_month?: string | null
          slot_reserved?: boolean | null
          status?: string | null
          tonnage?: number | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          issue_flag?: string | null
          issue_reason?: string | null
          materials_ordered?: boolean | null
          production_month?: string | null
          slot_reserved?: boolean | null
          status?: string | null
          tonnage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_confirmations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      production_plan: {
        Row: {
          actual_output: number | null
          b100_output: number | null
          glycerin_output: number | null
          id: string
          month: string
          notes: string | null
          status: string | null
          target_output: number
          uco_consumed: number | null
          updated_at: string | null
        }
        Insert: {
          actual_output?: number | null
          b100_output?: number | null
          glycerin_output?: number | null
          id?: string
          month: string
          notes?: string | null
          status?: string | null
          target_output: number
          uco_consumed?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_output?: number | null
          b100_output?: number | null
          glycerin_output?: number | null
          id?: string
          month?: string
          notes?: string | null
          status?: string | null
          target_output?: number
          uco_consumed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quality_tests: {
        Row: {
          acid_value: number | null
          certificate_number: string | null
          cetane_number: number | null
          cloud_point: number | null
          created_at: string | null
          density_at_15c: number | null
          flash_point: number | null
          id: string
          methanol_content: number | null
          notes: string | null
          overall_result: string | null
          oxidation_stability: number | null
          production_batch_id: string | null
          sulfur_content: number | null
          test_date: string
          tested_by: string | null
          viscosity_at_40c: number | null
          water_content: number | null
        }
        Insert: {
          acid_value?: number | null
          certificate_number?: string | null
          cetane_number?: number | null
          cloud_point?: number | null
          created_at?: string | null
          density_at_15c?: number | null
          flash_point?: number | null
          id?: string
          methanol_content?: number | null
          notes?: string | null
          overall_result?: string | null
          oxidation_stability?: number | null
          production_batch_id?: string | null
          sulfur_content?: number | null
          test_date?: string
          tested_by?: string | null
          viscosity_at_40c?: number | null
          water_content?: number | null
        }
        Update: {
          acid_value?: number | null
          certificate_number?: string | null
          cetane_number?: number | null
          cloud_point?: number | null
          created_at?: string | null
          density_at_15c?: number | null
          flash_point?: number | null
          id?: string
          methanol_content?: number | null
          notes?: string | null
          overall_result?: string | null
          oxidation_stability?: number | null
          production_batch_id?: string | null
          sulfur_content?: number | null
          test_date?: string
          tested_by?: string | null
          viscosity_at_40c?: number | null
          water_content?: number | null
        }
        Relationships: []
      }
      raw_material_orders: {
        Row: {
          actual_delivery: string | null
          auto_generated: boolean | null
          created_at: string | null
          expected_delivery: string | null
          id: string
          lead_time_days: number
          linked_month: string
          material: string
          notes: string | null
          order_date: string | null
          quantity_kg: number
          required_by: string
          status: string | null
          supplier: string | null
          unit_price: number | null
        }
        Insert: {
          actual_delivery?: string | null
          auto_generated?: boolean | null
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          lead_time_days: number
          linked_month: string
          material: string
          notes?: string | null
          order_date?: string | null
          quantity_kg: number
          required_by: string
          status?: string | null
          supplier?: string | null
          unit_price?: number | null
        }
        Update: {
          actual_delivery?: string | null
          auto_generated?: boolean | null
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          lead_time_days?: number
          linked_month?: string
          material?: string
          notes?: string | null
          order_date?: string | null
          quantity_kg?: number
          required_by?: string
          status?: string | null
          supplier?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          actual_arrival_date: string | null
          bill_of_lading_number: string | null
          container_numbers: string[] | null
          contract_id: string | null
          created_at: string | null
          customs_status: string | null
          deal_id: string | null
          departure_date: string | null
          destination: string | null
          eta_date: string | null
          freight_cost_usd: number | null
          id: string
          incoterm: string | null
          insurance_cost_usd: number | null
          notes: string | null
          origin: string | null
          shipment_ref: string
          status: string
          tonnes_delivered: number | null
          tonnes_loaded: number | null
          updated_at: string | null
          vessel_name: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          bill_of_lading_number?: string | null
          container_numbers?: string[] | null
          contract_id?: string | null
          created_at?: string | null
          customs_status?: string | null
          deal_id?: string | null
          departure_date?: string | null
          destination?: string | null
          eta_date?: string | null
          freight_cost_usd?: number | null
          id?: string
          incoterm?: string | null
          insurance_cost_usd?: number | null
          notes?: string | null
          origin?: string | null
          shipment_ref: string
          status?: string
          tonnes_delivered?: number | null
          tonnes_loaded?: number | null
          updated_at?: string | null
          vessel_name?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          bill_of_lading_number?: string | null
          container_numbers?: string[] | null
          contract_id?: string | null
          created_at?: string | null
          customs_status?: string | null
          deal_id?: string | null
          departure_date?: string | null
          destination?: string | null
          eta_date?: string | null
          freight_cost_usd?: number | null
          id?: string
          incoterm?: string | null
          insurance_cost_usd?: number | null
          notes?: string | null
          origin?: string | null
          shipment_ref?: string
          status?: string
          tonnes_delivered?: number | null
          tonnes_loaded?: number | null
          updated_at?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          closing_stock: number | null
          delivered: number | null
          id: string
          is_below_safety: boolean | null
          month: string
          opening_stock: number
          produced: number | null
          product: string
          purchased: number | null
          safety_stock_level: number | null
          safety_stock_unit: string
          unit: string
        }
        Insert: {
          closing_stock?: number | null
          delivered?: number | null
          id?: string
          is_below_safety?: boolean | null
          month: string
          opening_stock: number
          produced?: number | null
          product: string
          purchased?: number | null
          safety_stock_level?: number | null
          safety_stock_unit?: string
          unit?: string
        }
        Update: {
          closing_stock?: number | null
          delivered?: number | null
          id?: string
          is_below_safety?: boolean | null
          month?: string
          opening_stock?: number
          produced?: number | null
          product?: string
          purchased?: number | null
          safety_stock_level?: number | null
          safety_stock_unit?: string
          unit?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          areas: Json
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          rows_errored: number
          rows_read: number
          rows_skipped: number
          rows_upserted: number
          source: string
          started_at: string
          status: string
          trigger: string
          triggered_by: string | null
        }
        Insert: {
          areas?: Json
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          rows_errored?: number
          rows_read?: number
          rows_skipped?: number
          rows_upserted?: number
          source?: string
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Update: {
          areas?: Json
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          rows_errored?: number
          rows_read?: number
          rows_skipped?: number
          rows_upserted?: number
          source?: string
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          category: string
          created_at: string | null
          description: string
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          category: string
          created_at?: string | null
          description: string
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          link_id: string | null
          link_type: string | null
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
