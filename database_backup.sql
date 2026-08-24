--
-- PostgreSQL database dump
--

\restrict Zyw6Mt65xTP8HTbpDbD0ePIsYGSuiJnoswHACFmBY1OFVCNVi6Y5qaug00Dn395

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_timestamp_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assistant_calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assistant_calls (
    id character varying(100) NOT NULL,
    table_id character varying(100) NOT NULL,
    assistant_id uuid,
    type character varying(100) DEFAULT 'Call Waiter'::character varying NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assistant_calls_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Attended'::character varying, 'Resolved'::character varying])::text[])))
);


ALTER TABLE public.assistant_calls OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supabase_user_id uuid,
    fullname character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    delivery_address text,
    loyalty_points integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_loyalty_points_check CHECK ((loyalty_points >= 0))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supabase_user_id uuid,
    fullname character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    pin_code character varying(10),
    role character varying(50) NOT NULL,
    shift_status character varying(50) DEFAULT 'off_shift'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employees_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'cashier'::character varying, 'kitchen'::character varying, 'rider'::character varying, 'assistant'::character varying])::text[]))),
    CONSTRAINT employees_shift_status_check CHECK (((shift_status)::text = ANY ((ARRAY['on_shift'::character varying, 'off_shift'::character varying, 'on_break'::character varying])::text[])))
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category_id bigint NOT NULL,
    image text,
    is_available boolean DEFAULT true NOT NULL,
    spicy_level integer DEFAULT 0,
    preparation_time_mins integer DEFAULT 15,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT menu_items_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id bigint NOT NULL,
    order_id character varying(100) NOT NULL,
    menu_item_id character varying(100),
    snapshot_item_name character varying(255) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id character varying(100) NOT NULL,
    table_id character varying(100),
    customer_id uuid,
    cashier_id uuid,
    assistant_id uuid,
    rider_id uuid,
    type character varying(50) DEFAULT 'Take Out'::character varying NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    payment_status character varying(50) DEFAULT 'Paid'::character varying NOT NULL,
    payment_method character varying(50) DEFAULT 'Cash'::character varying NOT NULL,
    subtotal numeric(10,2) DEFAULT 0.00 NOT NULL,
    vat numeric(10,2) DEFAULT 0.00 NOT NULL,
    total numeric(10,2) DEFAULT 0.00 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['Cash'::character varying, 'GCash'::character varying, 'Card'::character varying, 'Maya'::character varying])::text[]))),
    CONSTRAINT orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['Paid'::character varying, 'Unpaid'::character varying, 'Refunded'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Preparing'::character varying, 'Ready'::character varying, 'Served'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[]))),
    CONSTRAINT orders_type_check CHECK (((type)::text = ANY ((ARRAY['Dine In'::character varying, 'Take Out'::character varying, 'Delivery'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.schema_migrations_id_seq OWNER TO postgres;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tables (
    id character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    seats integer DEFAULT 4 NOT NULL,
    section character varying(100) DEFAULT 'Main Dining'::character varying NOT NULL,
    status character varying(50) DEFAULT 'Available'::character varying NOT NULL,
    shape character varying(50) DEFAULT 'square'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tables_status_check CHECK (((status)::text = ANY ((ARRAY['Available'::character varying, 'Occupied'::character varying, 'Reserved'::character varying, 'Cleaning'::character varying])::text[])))
);


ALTER TABLE public.tables OWNER TO postgres;

--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Data for Name: assistant_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assistant_calls (id, table_id, assistant_id, type, status, created_at, updated_at) FROM stdin;
CALL-001	Table 3	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44	Water Refill	Pending	2026-08-12 13:41:46.355208+00	2026-08-12 13:46:46.355208+00
CALL-002	Table 7	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44	Request Bill	Pending	2026-08-12 13:44:46.355208+00	2026-08-12 13:46:46.355208+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, description, created_at) FROM stdin;
1	Seafood	Seafood Mixes, Paellas, and Bilao Feasts	2026-08-12 13:46:46.348172+00
2	Shrimp	Freshly caught Tiger Prawns and Buttered Shrimp	2026-08-12 13:46:46.348172+00
3	Crab	Mud Crabs and Soft-Shell Crabs	2026-08-12 13:46:46.348172+00
4	Drinks	Refreshing Juices, Shakes, and Soft Drinks	2026-08-12 13:46:46.348172+00
5	Sides	Rice Bowls, Sauces, and Dips	2026-08-12 13:46:46.348172+00
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, supabase_user_id, fullname, email, phone, delivery_address, loyalty_points, is_active, created_at, updated_at) FROM stdin;
b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11	66666666-6666-6666-6666-666666666666	Juan Tamad	customer1@gmail.com	09171234567	123 Mabini St, Sampaloc, Manila	120	t	2026-08-12 13:46:46.345145+00	2026-08-12 13:46:46.345145+00
b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22	77777777-7777-7777-7777-777777777777	Ana Reyes	ana.reyes@yahoo.com	09189876543	45 Quezon Ave, Quezon City	350	t	2026-08-12 13:46:46.345145+00	2026-08-12 13:46:46.345145+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, supabase_user_id, fullname, username, email, pin_code, role, shift_status, is_active, created_at, updated_at) FROM stdin;
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	11111111-1111-1111-1111-111111111111	Maria Santos	cashier1	cashier@seafudz.ph	1234	cashier	on_shift	t	2026-08-12 13:46:46.342541+00	2026-08-12 13:46:46.342541+00
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22	22222222-2222-2222-2222-222222222222	Chef Juan Dela Cruz	kitchen1	kitchen@seafudz.ph	5678	kitchen	on_shift	t	2026-08-12 13:46:46.342541+00	2026-08-12 13:46:46.342541+00
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33	33333333-3333-3333-3333-333333333333	Rider Alex Ramos	rider1	rider@seafudz.ph	9999	rider	on_shift	t	2026-08-12 13:46:46.342541+00	2026-08-12 13:46:46.342541+00
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44	44444444-4444-4444-4444-444444444444	Assistant Grace	assistant1	assistant@seafudz.ph	4321	assistant	on_shift	t	2026-08-12 13:46:46.342541+00	2026-08-12 13:46:46.342541+00
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55	55555555-5555-5555-5555-555555555555	Admin Manager	admin1	admin@seafudz.ph	0000	admin	on_shift	t	2026-08-12 13:46:46.342541+00	2026-08-12 13:46:46.342541+00
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_items (id, name, description, price, category_id, image, is_available, spicy_level, preparation_time_mins, created_at, updated_at) FROM stdin;
item-001	Seafood Bilao Feast	Generous combination of grilled prawns, crabs, clams, and squid over garlic butter rice.	2400.00	1	https://images.unsplash.com/photo-1559737671-6386bb0b5f14?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-002	Seafood Cajun Boil	Cajun-spiced seafood bucket with corn on the cob, potatoes, sausage, and mixed shellfish.	1850.00	1	https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-003	Classic Seafood Paella	Rich Spanish rice dish loaded with mussels, shrimp, squid rings, and saffron seasoning.	1650.00	1	https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-004	Grilled Seafood Platter	Assorted charcoal-grilled pompano, prawns, stuffed squid, and buttered clams.	2100.00	1	https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-005	Crispy Seafood Basket	Deep-fried golden fish fillet, calamari rings, and butterfly shrimp served with tartar dip.	980.00	1	https://images.unsplash.com/photo-1579712267685-42da233cb09b?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-006	Garlic Butter Prawns	Sauteed jumbo prawns drenched in garlic butter sauce topped with toasted garlic chips.	1250.00	2	https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-007	Sweet & Chili Crab Bucket	Fresh mud crabs simmered in sweet & spicy garlic tomato glaze.	1950.00	3	https://images.unsplash.com/photo-1559737671-6386bb0b5f14?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
item-008	Fresh Calamansi Juice Pitcher	Chilled fresh local calamansi juice infused with honey.	280.00	4	https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60	t	0	15	2026-08-12 13:46:46.352705+00	2026-08-12 13:46:46.352705+00
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, menu_item_id, snapshot_item_name, unit_price, quantity, notes, created_at) FROM stdin;
1	ORD-1001	item-001	Seafood Bilao Feast	2400.00	1	\N	2026-08-12 13:46:46.360156+00
2	ORD-358565	item-004	Grilled Seafood Platter	2100.00	1	\N	2026-08-16 08:19:18.564166+00
3	ORD-465601	item-004	Grilled Seafood Platter	2100.00	1	\N	2026-08-16 08:21:05.600718+00
4	ORD-904017	item-003	Classic Seafood Paella	1650.00	2	\N	2026-08-23 03:48:24.015283+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, table_id, customer_id, cashier_id, assistant_id, rider_id, type, status, payment_status, payment_method, subtotal, vat, total, notes, created_at, updated_at) FROM stdin;
ORD-1001	Table 1	b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44	\N	Dine In	Completed	Paid	GCash	2400.00	288.00	2688.00	\N	2026-08-12 12:46:46.357562+00	2026-08-12 13:46:46.357562+00
ORD-358565	Table 1	\N	\N	\N	\N	Take Out	Cancelled	Paid	Cash	2100.00	252.00	2352.00	\N	2026-08-16 08:19:18.564166+00	2026-08-16 08:19:51.116264+00
ORD-465601	Table 1	\N	\N	\N	\N	Take Out	Ready	Paid	Cash	2100.00	252.00	2352.00	\N	2026-08-16 08:21:05.600718+00	2026-08-16 08:21:48.888238+00
ORD-904017	Table 1	\N	\N	\N	\N	Take Out	Pending	Paid	Cash	3300.00	396.00	3696.00	\N	2026-08-23 03:48:24.015283+00	2026-08-23 03:48:24.015283+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schema_migrations (id, filename, applied_at) FROM stdin;
1	001_initial_schema.sql	2026-08-16 07:51:39.956209+00
\.


--
-- Data for Name: tables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tables (id, name, seats, section, status, shape, created_at, updated_at) FROM stdin;
Table 1	Table 1	4	Main Dining	Available	square	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 2	Table 2	2	Main Dining	Available	round	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 3	Table 3	6	Main Dining	Available	rectangle	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 4	Table 4	4	Main Dining	Available	square	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 5	Table 5	8	VIP Family Alcove	Available	rectangle	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 6	Table 6	4	VIP Family Alcove	Available	round	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 7	Table 7	2	Alfresco Patio	Available	round	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 8	Table 8	4	Alfresco Patio	Available	square	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 9	Table 9	6	Alfresco Patio	Available	rectangle	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 10	Table 10	4	Main Dining	Available	square	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 11	Table 11	2	Main Dining	Available	round	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
Table 12	Table 12	8	VIP Bilao Party	Available	rectangle	2026-08-12 13:46:46.350557+00	2026-08-12 13:46:46.350557+00
\.


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 4, true);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 1, true);


--
-- Name: assistant_calls assistant_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_calls
    ADD CONSTRAINT assistant_calls_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_supabase_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_supabase_user_id_key UNIQUE (supabase_user_id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_supabase_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_supabase_user_id_key UNIQUE (supabase_user_id);


--
-- Name: employees employees_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_username_key UNIQUE (username);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: tables tables_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_name_key UNIQUE (name);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: idx_assistant_calls_assistant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assistant_calls_assistant ON public.assistant_calls USING btree (assistant_id);


--
-- Name: idx_assistant_calls_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assistant_calls_table ON public.assistant_calls USING btree (table_id);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_supabase_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_supabase_user_id ON public.customers USING btree (supabase_user_id);


--
-- Name: idx_employees_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_role ON public.employees USING btree (role);


--
-- Name: idx_employees_supabase_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_supabase_user_id ON public.employees USING btree (supabase_user_id);


--
-- Name: idx_menu_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_category ON public.menu_items USING btree (category_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_assistant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_assistant ON public.orders USING btree (assistant_id);


--
-- Name: idx_orders_cashier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_cashier ON public.orders USING btree (cashier_id);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_rider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_rider ON public.orders USING btree (rider_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_table ON public.orders USING btree (table_id);


--
-- Name: assistant_calls update_assistant_calls_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_assistant_calls_modtime BEFORE UPDATE ON public.assistant_calls FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: customers update_customers_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: employees update_employees_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_employees_modtime BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: menu_items update_menu_items_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_menu_items_modtime BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: orders update_orders_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: tables update_tables_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tables_modtime BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_column();


--
-- Name: assistant_calls assistant_calls_assistant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_calls
    ADD CONSTRAINT assistant_calls_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: assistant_calls assistant_calls_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_calls
    ADD CONSTRAINT assistant_calls_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_assistant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: orders orders_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict Zyw6Mt65xTP8HTbpDbD0ePIsYGSuiJnoswHACFmBY1OFVCNVi6Y5qaug00Dn395

