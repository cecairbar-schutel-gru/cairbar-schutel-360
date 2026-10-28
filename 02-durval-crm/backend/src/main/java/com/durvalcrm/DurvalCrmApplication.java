package com.durvalcrm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

@SpringBootApplication
public class DurvalCrmApplication extends SpringBootServletInitializer {

    public static void main(String[] args) {
        SpringApplication.run(DurvalCrmApplication.class, args);
    }

    /** Implantação como WAR no Tomcat 11 provisionado pelo Ansible. */
    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(DurvalCrmApplication.class);
    }
}
